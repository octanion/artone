// ==== МАТЕМАТИКА ДЛЯ ОДНОГО СЛОЯ ====

function findBestCombinationForLayer(layer: any, S: number) {
  const products = layer.products || [];
  if (!products.length || S <= 0 || !Number.isFinite(S)) {
    return {
      layerId: layer.id,
      name: layer.name,
      order: layer.order,
      used: false,
      totalCoveredArea: 0,
      totalPrice: 0,
      products: [],
    };
  }

  const maxConsumption = products.reduce(
    (max: number, p: any) => Math.max(max, p.consumption || 0),
    0
  );
  if (maxConsumption <= 0) {
    return {
      layerId: layer.id,
      name: layer.name,
      order: layer.order,
      used: false,
      totalCoveredArea: 0,
      totalPrice: 0,
      products: [],
    };
  }

  const limit = S + maxConsumption;
  if (!Number.isFinite(limit) || limit <= 0) {
    return {
      layerId: layer.id,
      name: layer.name,
      order: layer.order,
      used: false,
      totalCoveredArea: 0,
      totalPrice: 0,
      products: [],
    };
  }

  const INF = Number.MAX_SAFE_INTEGER;
  const dp: number[] = new Array(limit + 1).fill(INF);
  const prev: { prevArea: number; productIndex: number }[] = new Array(
    limit + 1
  ).fill(null as any);

  dp[0] = 0;

  for (let area = 0; area <= limit; area++) {
    if (dp[area] === INF) continue;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const c = p.consumption || 0; // м² с одной банки
      const price = p.price || 0;

      if (c <= 0) continue;

      const nextArea = area + c;
      if (nextArea > limit) continue;

      const nextCost = dp[area] + price;
      if (nextCost < dp[nextArea]) {
        dp[nextArea] = nextCost;
        prev[nextArea] = { prevArea: area, productIndex: i };
      }
    }
  }

  let bestArea = -1;
  let bestCost = INF;
  for (let area = S; area <= limit; area++) {
    if (dp[area] < bestCost) {
      bestCost = dp[area];
      bestArea = area;
    }
  }

  if (bestArea === -1 || bestCost === INF) {
    return {
      layerId: layer.id,
      name: layer.name,
      order: layer.order,
      used: false,
      totalCoveredArea: 0,
      totalPrice: 0,
      products: [],
    };
  }

  const countByIndex: Record<number, number> = {};
  let curArea = bestArea;
  while (curArea > 0 && prev[curArea]) {
    const { prevArea, productIndex } = prev[curArea];
    countByIndex[productIndex] = (countByIndex[productIndex] || 0) + 1;
    curArea = prevArea;
  }

  const productsResult: any[] = [];
  let totalCoveredArea = 0;
  let totalPrice = 0;

  Object.entries(countByIndex).forEach(([indexStr, count]) => {
    const idx = Number(indexStr);
    const p = products[idx];
    const coveredArea = (p.consumption || 0) * (count as number);
    const price = p.price || 0;
    const layerPrice = price * (count as number);

    totalCoveredArea += coveredArea;
    totalPrice += layerPrice;

    productsResult.push({
      productId: p.id,
      name: p.name,
      packageVolume: p.packageVolume,
      price,
      consumption: p.consumption,
      count,
      coveredArea,
      totalPrice: layerPrice,
    });
  });

  productsResult.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));

  return {
    layerId: layer.id,
    name: layer.name,
    order: layer.order,
    used: true,
    totalCoveredArea,
    totalPrice,
    products: productsResult,
  };
}

// ==== КАЛЬКУЛЯТОР finchhand ====

function calcFinchHand({ system, answers, color }: any) {
  const quest = system.quest;

  // площадь из анкеты
  const Sraw = answers?.consumptionquest;
  const S = typeof Sraw === "string" ? parseFloat(Sraw) : Number(Sraw || 0);

  let calcResult: any = null;

  if (!Number.isFinite(S) || S <= 0) {
    // некорректная площадь — просто возвращаем базовый ответ без расчёта
    return {
      type: "finchhand",
      result: null,
      answers,
      quest,
    };
  }

  if (Array.isArray(system.layers)) {
    const layers = [...system.layers].sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );

    const layerResults: any[] = [];
    let totalCoveredArea = 0;
    let totalPrice = 0;

    const useGgp = !!answers?.ggp; // чекбокс "Грунт глубокого проникновения"
    const usePrimer = !!answers?.primerpaint; // чекбокс "грунт-праймер"

    for (const layer of layers) {
      const nameStr = (layer.name || "").toString().toLowerCase();

      // решаем, учитывать слой или нет
      let shouldUse = true;
      if (
        nameStr.includes("глубокого проникновения") ||
        nameStr.includes("фикс супер")
      ) {
        shouldUse = useGgp;
      } else if (nameStr.includes("primer") || nameStr.includes("праймер")) {
        shouldUse = usePrimer;
      } else {
        // слой краски — всегда считаем
        shouldUse = true;
      }

      if (!shouldUse) {
        layerResults.push({
          layerId: layer.id,
          name: layer.name,
          order: layer.order,
          used: false,
          totalCoveredArea: 0,
          totalPrice: 0,
          products: [],
        });
        continue;
      }

      // если слой "Finch A валиком" — считаем с +10% запаса (округляем вниз)
      const isFinchA = nameStr.includes("finch a валиком");
      const layerS = isFinchA ? Math.floor(S * 1.1) : S;

      const layerResult = findBestCombinationForLayer(layer, layerS);
      layerResults.push(layerResult);

      if (layerResult.used) {
        totalCoveredArea = Math.max(
          totalCoveredArea,
          layerResult.totalCoveredArea
        );
        totalPrice += layerResult.totalPrice;
      }
    }

    calcResult = {
      systemId: system.id,
      name: system.name,
      totalCoveredArea,
      totalPrice,
      layers: layerResults,
    };

    // === колеровка для слоя краски (Finch A ...) ===
    let kolerPrice = 0;

    if (color && Array.isArray(calcResult.layers)) {
      const extra = Number(color.priceExtra || 0); // цена колера на 1 л
      console.log("Color extra:", extra, "layers:", calcResult.layers.length);

      if (extra > 0) {
        for (const layer of calcResult.layers) {
          const nameStr = (layer.name || "").toString().toLowerCase();
          const isPaintLayer = nameStr.includes("finch a"); // слой краски
          console.log(
            "Layer for koler:",
            layer.name,
            "used:",
            layer.used,
            "isPaint:",
            isPaintLayer
          );

          if (!isPaintLayer || !layer.used) continue;

          for (const p of layer.products || []) {
            const count = Number(p.count || 0);
            const vol = Number(p.packageVolume || 0); // 0.9 / 2 / 4 / 9

            console.log("Product for koler:", {
              name: p.name,
              count,
              vol,
              price: p.price,
            });

            if (count <= 0) continue;

            // коэффициент по объёму банки
            let k = 0;
            if (vol <= 1) k = 1; // 0.9 л
            else if (vol <= 2.1) k = 2; // 2 л
            else if (vol <= 4.1) k = 4; // 4 л
            else if (vol <= 9.1) k = 9; // 9 л

            if (k > 0) {
              const add = count * extra * k;
              kolerPrice += add;
              console.log("Koler add:", add, "kolerPrice now:", kolerPrice);
            }
          }
        }
      }
    }

    if (kolerPrice > 0) {
      console.log("Final kolerPrice:", kolerPrice);
      calcResult.totalPrice += kolerPrice;
      calcResult.kolerPrice = kolerPrice;
    }
  }

  // возвращаем тот же формат
  return {
    type: "finchhand",
    result: calcResult ?? "calculated",
    answers,
    quest,
  };
}

// ==== РЕГИСТР КАЛЬКУЛЯТОРОВ ====

const calculators: Record<string, (params: any) => any> = {
  finchhand: calcFinchHand,
};

// ==== ОБЁРТКА run: ИДЁМ ОТ artsystem → system ====

export default {
  async run(artsystemId: any, answers: any) {
    console.log("Calc service called:", { artsystemId, answers });

    const artsystem = await (strapi as any).entityService.findOne(
      "api::artsystem.artsystem",
      artsystemId,
      {
        populate: {
          quest: {
            populate: ["fields"],
          },
          systems: {
            populate: {
              quest: {
                populate: ["fields"],
              },
              layers: {
                populate: {
                  products: true,
                },
              },
              finchcolors: true,
            },
          },
        },
      }
    );

    if (!artsystem?.quest) {
      throw new Error("Quest not found");
    }

    const systems = artsystem.systems || [];
    if (!systems.length) {
      throw new Error("No systems linked to artsystem");
    }

    // параметры выбора из анкеты
    const nanesenie = answers?.nanesenie;
    const colorId = answers?.colorpaint;

    console.log("Answers:", answers);
    console.log("nanesenie:", nanesenie, "colorId:", colorId);

    // выбор system по нанесению
    let system =
      systems.find((s: any) => s.nanesenie === nanesenie) || systems[0];

    console.log("Selected system:", system?.id, "for nanesenie:", nanesenie);

    if (!system) {
      throw new Error("Suitable system not found");
    }

    // грузим выбранный цвет
    let color: any = null;
    if (colorId) {
      color = await (strapi as any).entityService.findOne(
        "api::finchcolor.finchcolor",
        colorId
      );
      console.log(
        "Selected color:",
        colorId,
        "->",
        color?.name,
        "extra:",
        color?.priceExtra
      );
    }

    const calcType = (artsystem.quest as any).calctype;
    console.log("Calc type:", calcType);

    const calculator = calculators[calcType];
    if (!calculator) {
      throw new Error(`Unknown calctype: ${calcType}`);
    }

    // прокидываем quest от artsystem в system, чтобы калькулятор его видел как раньше
    (system as any).quest = artsystem.quest;

    return calculator({ system, answers, color });
  },
};
