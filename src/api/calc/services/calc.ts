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

// ==== ТВОЙ КАЛЬКУЛЯТОР finchhand (СТАРЫЙ ФОРМАТ ОТВЕТА) ====

function calcFinchHand({ system, answers }: any) {
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

    for (const layer of layers) {
      // если слой "Finch A валиком" — считаем с +10% запаса (округляем вниз)
      const isFinchA =
        (layer.name || "").toString().toLowerCase().includes("finch a валиком");
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
  }

  // ВАЖНО: возвращаем ТОЧНО тот же формат, что и раньше
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
  // если были другие типы, добавь их сюда
};

// ==== ОБЁРТКА run (ПОЧТИ КАК БЫЛО) ====

export default {
  async run(systemId: any, answers: any) {
    console.log("Calc service called:", { systemId, answers });

    const system = await (strapi as any).entityService.findOne(
      "api::system.system",
      systemId,
      {
        populate: {
          quest: {
            populate: ["fields"],
          },
          layers: {
            populate: {
              products: true,
            },
          },
        },
      }
    );

    if (!system?.quest) {
      throw new Error("Quest not found");
    }

    const calcType = (system.quest as any).calctype;
    console.log("Calc type:", calcType);

    const calculator = calculators[calcType];
    if (!calculator) {
      throw new Error(`Unknown calctype: ${calcType}`);
    }

    return calculator({ system, answers });
  },
};
