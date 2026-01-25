import { useEffect, useState } from "react";

// Новый компонент вывода результатов
function CalcResult({ data }) {
  if (!data || !data.result) return null;

  const { result, answers } = data;

  // 1) система и выбранный цвет (пока показываем ID цвета)
  const systemName = result.name;
  const colorId = answers?.colorpaint;

  // фильтрация слоёв по флагам primerpaint / ggp
  const filteredLayers = (result.layers || []).filter((layer) => {
    const name = (layer.name || "").toLowerCase();

    if (name.includes("глубокого проникновения") || name.includes("ггп")) {
      return !!answers?.ggp;
    }
    if (name.includes("праймер")) {
      return !!answers?.primerpaint;
    }
    return true;
  });

  // цена всех слоёв
  const totalLayersPrice = filteredLayers.reduce(
    (sum, layer) => sum + (layer.totalPrice || 0),
    0
  );

  // общий примерный вес по слоям (1л ~ 1кг, 5л ~ 5кг — потом заменим на weight)
  const totalLayersWeight = filteredLayers.reduce((sum, layer) => {
    const layerWeight = (layer.products || []).reduce((acc, p) => {
      const count = p.count || 0;
      const vol = p.packageVolume || "";
      const approxKg = vol.includes("5") ? 5 : 1;
      return acc + count * approxKg;
    }, 0);
    return sum + layerWeight;
  }, 0);

  // 3) цена колеровки — пока 0 (потом подставим из справочника)
  const colorPrice = 0;

  // 4) общая стоимость
  const grandTotalPrice = totalLayersPrice + colorPrice;

  return (
    <section style={{ marginTop: 24 }}>
      {/* 1) строка: система + цвет */}
      <h2>Результат расчёта</h2>
      <p>
        Система: <strong>{systemName}</strong>; выбранный цвет:{" "}
        <strong>{colorId || "не выбран"}</strong>
      </p>

      {/* 2) слои по выбранным флагам */}
      {filteredLayers.map((layer) => {
        const layerWeight = (layer.products || []).reduce((acc, p) => {
          const count = p.count || 0;
          const vol = p.packageVolume || "";
          const approxKg = vol.includes("5") ? 5 : 1;
          return acc + count * approxKg;
        }, 0);

        return (
          <div key={layer.layerId} style={{ marginTop: 16 }}>
            <h3>{layer.name}</h3>
            <p>
              Покрытие слоя: {layer.totalCoveredArea} м²; стоимость слоя:{" "}
              {layer.totalPrice} ₽; примерный вес слоя: {layerWeight} кг
            </p>
            <ul>
              {(layer.products || []).map((p) => (
                <li key={p.productId}>
                  {p.name} ({p.packageVolume}) — {p.count} шт., покрытие{" "}
                  {p.coveredArea} м², стоимость {p.totalPrice} ₽
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {/* 3) цена колеровки */}
      <p style={{ marginTop: 16 }}>
        Цена колеровки: <strong>{colorPrice}</strong> ₽
      </p>

      {/* 4) общая стоимость и вес */}
      <p>
        Общая стоимость всех слоёв и колеровки:{" "}
        <strong>{grandTotalPrice}</strong> ₽
      </p>
      <p>
        Общий примерный вес: <strong>{totalLayersWeight}</strong> кг
      </p>
    </section>
  );
}

function App() {
  const [systems, setSystems] = useState([]);
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [questFields, setQuestFields] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [relationOptions, setRelationOptions] = useState({}); // { finchcolor: [ ... ] }
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Загружаем список систем
  useEffect(() => {
    async function loadSystems() {
      try {
        const res = await fetch("http://localhost:1337/api/systems");
        const data = await res.json();
        setSystems(data.data || data || []);
      } catch (e) {
        console.error("Ошибка загрузки systems", e);
      }
    }

    loadSystems();
  }, []);

  const handleFieldChange = (field, value) => {
    setFormValues((prev) => ({
      ...prev,
      [field.name]: value,
    }));
  };

  // Загружаем варианты для relation‑коллекций, которые встретились в fields
  const loadRelationCollections = async (fields) => {
    const collections = Array.from(
      new Set(
        fields
          .filter((f) => f.type === "relation" && f.relationCollection)
          .map((f) => f.relationCollection)
      )
    );

    if (!collections.length) return;

    const newOptions = { ...relationOptions };

    for (const col of collections) {
      // если уже загружали — пропускаем
      if (newOptions[col]) continue;

      try {
        const res = await fetch(`http://localhost:1337/api/${col}s`);
        const data = await res.json();
        // приводим к простому виду { id, name }
        const items = (data.data || data || []).map((item) => ({
          id: item.id,
          name:
            item.name ||
            item.title ||
            item.attributes?.name ||
            `#${item.id}`,
        }));
        newOptions[col] = items;
      } catch (e) {
        console.error("Ошибка загрузки relation options", col, e);
        newOptions[col] = [];
      }
    }

    setRelationOptions(newOptions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!selectedSystemId) {
        setError("Сначала выбери систему");
        setLoading(false);
        return;
      }

      const answers = formValues;

      const res = await fetch("http://localhost:1337/api/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemId: Number(selectedSystemId),
          answers,
        }),
      });

      const data = await res.json();
      setResponse(data);

      if (data && data.quest && Array.isArray(data.quest.fields)) {
        const fields = data.quest.fields;
        setQuestFields(fields);

        const initial = {};
        fields.forEach((f) => {
          initial[f.name] = answers[f.name] ?? "";
        });
        setFormValues(initial);

        // тянем варианты для relation‑полей
        loadRelationCollections(fields);
      } else {
        setQuestFields([]);
        setFormValues({});
      }
    } catch (err) {
      setError("Ошибка запроса");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderFieldInput = (field) => {
    const value = formValues[field.name] ?? "";

    if (field.type === "boolean") {
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => handleFieldChange(field, e.target.checked)}
        />
      );
    }

    if (field.type === "number") {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          style={{ width: "100%" }}
        />
      );
    }

    if (field.type === "relation" && field.relationCollection) {
      const options = relationOptions[field.relationCollection] || [];
      return (
        <select
          value={value}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          style={{ width: "100%" }}
        >
          <option value="">-- выбери вариант --</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleFieldChange(field, e.target.value)}
        style={{ width: "100%" }}
      />
    );
  };

  const answersJson = JSON.stringify(formValues, null, 2);

  return (
    <div style={{ padding: "24px", fontFamily: "sans-serif", color: "white" }}>
      <h1>Quest калькулятор</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Система:
            <select
              value={selectedSystemId}
              onChange={(e) => setSelectedSystemId(e.target.value)}
              style={{ width: "100%", marginTop: 4 }}
            >
              <option value="">-- выбери систему --</option>
              {systems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name ||
                    item.attributes?.name ||
                    `System #${item.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        {questFields.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {questFields.map((field) => (
              <div
                key={field.id}
                style={{
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: "1px solid #333",
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <strong>{field.label || field.name}</strong>
                  {field.required && (
                    <span style={{ color: "orange" }}> *</span>
                  )}
                </div>
                {field.help && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#aaa",
                      marginBottom: 4,
                    }}
                  >
                    {field.help}
                  </div>
                )}
                {renderFieldInput(field)}
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Отправка..." : "Отправить в /api/calc"}
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

      <h2 style={{ marginTop: 24 }}>Answers (JSON, который уходит в API):</h2>
      <pre style={{ background: "#222", padding: 12 }}>{answersJson}</pre>

      <h2 style={{ marginTop: 24 }}>Ответ API:</h2>
      <pre style={{ background: "#222", padding: 12 }}>
        {response ? JSON.stringify(response, null, 2) : "Пока пусто"}
      </pre>

      {/* Визуальный вывод результата калькулятора */}
      <CalcResult data={response} />
    </div>
  );
}

export default App;
