// src/App.jsx
import { useEffect, useState, useRef } from "react";

function App() {
  // state 1: выбор системы
  const [allSystems, setAllSystems] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedSystem, setSelectedSystem] = useState(null);

  // автокомплит
  const [loadingSystems, setLoadingSystems] = useState(true);
  const [systemsError, setSystemsError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // state 2: квест и форма
  const [step, setStep] = useState(1); // 1 — выбор системы, 2 — вопросы
  const [questFields, setQuestFields] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [loadingQuest, setLoadingQuest] = useState(false);
  const [questError, setQuestError] = useState("");
  const [relationOptions, setRelationOptions] = useState({}); // { finchcolor: [...] }

  // результат расчёта
  const [calcResult, setCalcResult] = useState(null);

  const inputRef = useRef(null);
  const listRef = useRef(null);

  // ---------- загрузка artsystem (state 1) ----------
  useEffect(() => {
    async function loadArtSystems() {
      try {
        setLoadingSystems(true);
        setSystemsError("");

        const res = await fetch("http://localhost:1337/api/artsystems");
        if (!res.ok) throw new Error(`Ошибка ответа ${res.status}`);

        const data = await res.json();
        const items = (data.data || data || []).map((item) => ({
          id: item.id,
          name: item.ArtSystemsID,
        }));

        setAllSystems(items);
      } catch (e) {
        console.error(e);
        setSystemsError("Не удалось загрузить artsystem");
      } finally {
        setLoadingSystems(false);
      }
    }

    loadArtSystems();
  }, []);

  const suggestions = allSystems.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(!!value);
    setHighlightIndex(-1);
  };

  const selectSystem = (system) => {
    setSelectedSystem(system);
    setQuery(system.name);
    setIsOpen(false);
    setHighlightIndex(-1);
    // переходим к шагу 2 — загрузка квеста
    loadQuestForSystem(system);
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1,
      );
    } else if (e.key === "Enter") {
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault();
        selectSystem(suggestions[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        !inputRef.current?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      ) {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---------- загрузка квеста и его полей (state 2) ----------
  const loadQuestForSystem = async (system) => {
    try {
      setLoadingQuest(true);
      setQuestError("");
      setQuestFields([]);
      setFormValues({});
      setRelationOptions({});
      setCalcResult(null);

      // имя квеста совпадает с calctype/названием quest в Strapi:
      // для Finch: finchquest, для Траверто: travertonaturalequest
      const questName =
        system.name === "Траверто Натурале"
          ? "travertonaturalequest"
          : "finchquest";

      const res = await fetch(
        `http://localhost:1337/api/quests?filters[name][$eq]=${encodeURIComponent(
          questName,
        )}&populate=fields`,
      );
      if (!res.ok) throw new Error(`Ошибка ответа ${res.status}`);

      const data = await res.json();
      const quest = data.data?.[0];
      if (!quest || !quest.fields) {
        throw new Error("Квест или его поля не найдены");
      }

      const fields = quest.fields;
      setQuestFields(fields);

      // первичные значения формы
      const initial = {};
      fields.forEach((f) => {
        if (f.type === "boolean") initial[f.name] = false;
        else initial[f.name] = "";
      });
      setFormValues(initial);

      // подгружаем варианты для relation-полей
      await loadRelationCollections(fields);

      setStep(2);
    } catch (e) {
      console.error(e);
      setQuestError("Не удалось загрузить вопросы для системы");
    } finally {
      setLoadingQuest(false);
    }
  };

  // загрузка справочников для relation-полей
  const loadRelationCollections = async (fields) => {
    const collections = Array.from(
      new Set(
        fields
          .filter((f) => f.type === "relation" && f.relationCollection)
          .map((f) => f.relationCollection),
      ),
    );
    if (!collections.length) return;

    const newOptions = {};

    for (const col of collections) {
      try {
        const res = await fetch(`http://localhost:1337/api/${col}s`);
        const data = await res.json();
        const items = (data.data || data || []).map((item) => {
          const attrs = item.attributes || item;
          return {
            id: item.id,
            name: attrs.name || attrs.title || `#${item.id}`,
            price: attrs.price ?? 0,
          };
        });
        newOptions[col] = items;
      } catch (e) {
        console.error("Ошибка загрузки relation options", col, e);
        newOptions[col] = [];
      }
    }

    setRelationOptions(newOptions);
  };

  const handleFieldChange = (field, value) => {
    setFormValues((prev) => ({
      ...prev,
      [field.name]: value,
    }));
  };

  const handleBackToStep1 = () => {
    setStep(1);
  };

  const handleCalculate = async () => {
    try {
      console.log("Отправляем на расчёт", {
        artsystemId: selectedSystem?.id,
        answers: formValues,
      });

      const res = await fetch("http://localhost:1337/api/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artsystemId: selectedSystem?.id,
          answers: formValues,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ошибка ответа ${res.status}: ${text}`);
      }

      const data = await res.json();
      console.log("Результат расчёта", data);
      setCalcResult(data);
    } catch (e) {
      console.error("Ошибка расчёта", e);
    }
  };

  // ---------- рендер ----------

  return (
    <div className="app-root">
      <div className="search-card">
        <h1 className="app-title">Выбор системы</h1>

        {/* state 1: выбор системы */}
        <div className="autocomplete-root">
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            placeholder="Начни вводить название системы..."
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={step !== 1}
          />

          {loadingSystems && <p className="hint">Загрузка списка систем...</p>}
          {systemsError && <p className="error">{systemsError}</p>}

          {isOpen && !loadingSystems && !systemsError && query && (
            <ul className="search-list" ref={listRef}>
              {suggestions.length === 0 && (
                <li className="search-item muted">Ничего не найдено</li>
              )}
              {suggestions.map((s, index) => (
                <li
                  key={s.id}
                  className={
                    "search-item" +
                    (index === highlightIndex ? " search-item--active" : "")
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSystem(s);
                  }}
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedSystem && (
          <p className="hint" style={{ marginTop: 12 }}>
            Выбрана система: <strong>{selectedSystem.name}</strong> (id:{" "}
            {selectedSystem.id})
          </p>
        )}

        {/* state 2: вопросы квеста */}
        {step === 2 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>
              Параметры расчёта
            </h2>

            {loadingQuest && (
              <p className="hint">Загрузка опроса для системы...</p>
            )}
            {questError && <p className="error">{questError}</p>}

            {!loadingQuest &&
              !questError &&
              questFields.map((field) => {
                const value = formValues[field.name] ?? "";

                let inputEl = null;

                if (field.type === "boolean") {
                  inputEl = (
                    <input
                      type="checkbox"
                      checked={!!value}
                      onChange={(e) =>
                        handleFieldChange(field, e.target.checked)
                      }
                    />
                  );
                } else if (field.type === "number") {
                  inputEl = (
                    <input
                      className="text-input"
                      type="number"
                      value={value}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                    />
                  );
                } else if (
                  field.type === "relation" &&
                  field.relationCollection
                ) {
                  const options =
                    relationOptions[field.relationCollection] || [];
                  inputEl = (
                    <select
                      className="text-input"
                      value={value}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                    >
                      <option value="">-- выберите вариант --</option>
                      {options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  );
                } else if (field.type === "select") {
                  const options = Array.isArray(field.option)
                    ? field.option
                    : [];

                  inputEl = (
                    <select
                      className="text-input"
                      value={value}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                    >
                      <option value="">-- выберите вариант --</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  );
                } else {
                  inputEl = (
                    <input
                      className="text-input"
                      type="text"
                      value={value}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                    />
                  );
                }

                return (
                  <div
                    key={field.id}
                    style={{
                      marginBottom: 14,
                      paddingBottom: 10,
                      borderBottom: "1px solid #374151",
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
                          color: "#9ca3af",
                          marginBottom: 4,
                        }}
                      >
                        {field.help}
                      </div>
                    )}
                    {inputEl}
                  </div>
                );
              })}

            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <button type="button" onClick={handleBackToStep1}>
                ← Назад
              </button>
              <button type="button" onClick={handleCalculate}>
                Рассчитать
              </button>
            </div>

            {calcResult && (
              <div
                style={{
                  marginTop: 24,
                  padding: 16,
                  borderRadius: 8,
                  border: "1px solid #374151",
                  textAlign: "left",
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>
                  Результат расчёта
                </h3>

                {calcResult.result && typeof calcResult.result === "object" ? (
                  <>
                    <p style={{ margin: "4px 0" }}>
                      Система: <strong>{calcResult.result.name}</strong>
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      Общая площадь покрытия:{" "}
                      <strong>{calcResult.result.totalCoveredArea}</strong> м²
                    </p>

                    {Array.isArray(calcResult.result.layers) &&
                      calcResult.result.layers
                        .filter((layer) => layer.used)
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((layer) => (
                          <div
                            key={layer.layerId}
                            style={{
                              marginTop: 12,
                              paddingTop: 8,
                              borderTop: "1px dashed #4b5563",
                            }}
                          >
                            <p style={{ margin: "0 0 4px" }}>
                              <strong>{layer.name}</strong>{" "}
                              <span style={{ color: "#9ca3af", fontSize: 13 }}>
                                (стоимость слоя: {layer.totalPrice} ₽)
                              </span>
                            </p>

                            {Array.isArray(layer.products) &&
                            layer.products.length > 0 ? (
                              <ul
                                style={{
                                  margin: "4px 0 0",
                                  paddingLeft: 18,
                                  fontSize: 14,
                                }}
                              >
                                {layer.products.map((p) => (
                                  <li key={p.productId}>
                                    {p.name} — {p.count} шт. × {p.packageVolume}{" "}
                                    л по {p.price} ₽ = {p.totalPrice} ₽
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p
                                style={{
                                  margin: "4px 0",
                                  fontSize: 14,
                                  color: "#9ca3af",
                                }}
                              >
                                Для этого слоя материалы не подобраны.
                              </p>
                            )}
                          </div>
                        ))}

                    {calcResult.result.kolerPrice > 0 && (
                      <p style={{ margin: "8px 0 0" }}>
                        Колеровка:{" "}
                        <strong>{calcResult.result.kolerPrice}</strong> ₽
                      </p>
                    )}

                    <p style={{ margin: "8px 0 0" }}>
                      Общая стоимость материалов:{" "}
                      <strong>{calcResult.result.totalPrice}</strong> ₽
                    </p>
                  </>
                ) : (
                  <p style={{ margin: "4px 0" }}>Расчёт выполнен.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
