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
    0,
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
    limit + 1,
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

  productsResult.sort(
    (a, b) => a.price - b.price || a.name.localeCompare(b.name),
  );

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

  const Sraw = answers?.consumptionquest;
  const S = typeof Sraw === "string" ? parseFloat(Sraw) : Number(Sraw || 0);

  let calcResult: any = null;

  if (!Number.isFinite(S) || S <= 0) {
    return {
      type: "finchhand",
      result: null,
      answers,
      quest,
    };
  }

  if (Array.isArray(system.layers)) {
    const layers = [...system.layers].sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );

    const layerResults: any[] = [];
    let totalCoveredArea = 0;
    let totalPrice = 0;

    const useGgp = !!answers?.ggp;
    const usePrimer = !!answers?.primerpaint;

    for (const layer of layers) {
      const nameStr = (layer.name || "").toString().toLowerCase();

      let shouldUse = true;
      if (
        nameStr.includes("глубокого проникновения") ||
        nameStr.includes("фикс супер")
      ) {
        shouldUse = useGgp;
      } else if (nameStr.includes("primer") || nameStr.includes("праймер")) {
        shouldUse = usePrimer;
      } else {
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

      const isFinchA = nameStr.includes("finch a валиком");
      const layerS = isFinchA ? Math.floor(S * 1.1) : S;

      const layerResult = findBestCombinationForLayer(layer, layerS);
      layerResults.push(layerResult);

      if (layerResult.used) {
        totalCoveredArea = Math.max(
          totalCoveredArea,
          layerResult.totalCoveredArea,
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

    let kolerPrice = 0;

    if (color && Array.isArray(calcResult.layers)) {
      const extra = Number(color.priceExtra || 0);
      console.log("Color extra:", extra, "layers:", calcResult.layers.length);

      if (extra > 0) {
        for (const layer of calcResult.layers) {
          const nameStr = (layer.name || "").toString().toLowerCase();
          const isPaintLayer = nameStr.includes("finch a");
          console.log(
            "Layer for koler:",
            layer.name,
            "used:",
            layer.used,
            "isPaint:",
            isPaintLayer,
          );

          if (!isPaintLayer || !layer.used) continue;

          for (const p of layer.products || []) {
            const count = Number(p.count || 0);
            const vol = Number(p.packageVolume || 0);

            console.log("Product for koler:", {
              name: p.name,
              count,
              vol,
              price: p.price,
            });

            if (count <= 0) continue;

            let k = 0;
            if (vol <= 1) k = 1;
            else if (vol <= 2.1) k = 2;
            else if (vol <= 4.1) k = 4;
            else if (vol <= 9.1) k = 9;

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

  return {
    type: "finchhand",
    result: calcResult ?? "calculated",
    answers,
    quest,
  };
}

// ==== КАЛЬКУЛЯТОР travertonaturale ====

function calcTravertoNaturale({ system, answers, color }: any) {
  const quest = system.quest;

  const Sraw = answers?.consumptionquest;
  const S = typeof Sraw === "string" ? parseFloat(Sraw) : Number(Sraw || 0);

  let calcResult: any = null;

  if (!Number.isFinite(S) || S <= 0) {
    return {
      type: "travertonaturale",
      result: null,
      answers,
      quest,
    };
  }

  if (Array.isArray(system.layers)) {
    const layers = [...system.layers].sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );

    const layerResults: any[] = [];
    let totalCoveredArea = 0;
    let totalPrice = 0;

    const useFix = !!answers?.ggp; // Фикс Супер
    const useFon = !!answers?.primerfon; // Фон (по твоему полю primerfon)
    const travertoLac = answers?.travertolac; // none | matt | gloss

    for (const layer of layers) {
      const nameStr = (layer.name || "").toString().toLowerCase();

      let shouldUse = true;

      if (nameStr.includes("фикс супер")) {
        shouldUse = useFix;
      } else if (nameStr === "фон" || nameStr.includes("фон ")) {
        shouldUse = useFon;
      } else if (nameStr.includes("траверто натурале")) {
        shouldUse = true; // всегда
      } else if (
        nameStr.includes("креатив матовый") ||
        nameStr.includes("креатив глянцевый") ||
        nameStr.includes("лак")
      ) {
        shouldUse = travertoLac && travertoLac !== "none";
      } else {
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

      const isTraverto = nameStr.includes("траверто натурале");
      const layerS = isTraverto ? Math.floor(S * 1.1) : S;

      const layerResult = findBestCombinationForLayer(layer, layerS);
      layerResults.push(layerResult);

      if (layerResult.used) {
        totalCoveredArea = Math.max(
          totalCoveredArea,
          layerResult.totalCoveredArea,
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

    // колеровка траверто (если понадобится, аналог финча — сейчас выключена)
    // можно будет донастроить, когда появится travertocolor
  }

  return {
    type: "travertonaturale",
    result: calcResult ?? "calculated",
    answers,
    quest,
  };
}

// ==== РЕГИСТР КАЛЬКУЛЯТОРОВ ====

const calculators: Record<string, (params: any) => any> = {
  finchhand: calcFinchHand,
  travertonaturale: calcTravertoNaturale,
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
              travertocolor: true,
            },
          },
        },
      },
    );

    if (!artsystem?.quest) {
      throw new Error("Quest not found");
    }

    const systems = artsystem.systems || [];
    if (!systems.length) {
      throw new Error("No systems linked to artsystem");
    }

    const nanesenie = answers?.nanesenie;
    const colorId = answers?.colorpaint || answers?.travertocolorpaint;

    console.log("Answers:", answers);
    console.log("nanesenie:", nanesenie, "colorId:", colorId);

    let system =
      systems.find((s: any) => s.nanesenie === nanesenie) || systems[0];

    console.log("Selected system:", system?.id, "for nanesenie:", nanesenie);

    if (!system) {
      throw new Error("Suitable system not found");
    }

    let color: any = null;
    if (colorId) {
      // пока используем finchcolor; позже можно разветвить по calcType
      color = await (strapi as any).entityService.findOne(
        "api::finchcolor.finchcolor",
        colorId,
      );
      console.log(
        "Selected color:",
        colorId,
        "->",
        color?.name,
        "extra:",
        color?.priceExtra,
      );
    }

    const calcType = (artsystem.quest as any).calctype;
    console.log("Calc type:", calcType);

    const calculator = calculators[calcType];
    if (!calculator) {
      throw new Error(`Unknown calctype: ${calcType}`);
    }

    (system as any).quest = artsystem.quest;

    return calculator({ system, answers, color });
  },
};
