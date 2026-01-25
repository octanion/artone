function calcFinchHand({ system, answers }: any) {
  const quest = (system as any).quest;

  // Пока заглушка: просто возвращаем данные, чтобы фронт мог их использовать
  return {
    type: 'finchhand',
    result: 'calculated',
    answers,
    quest,
  };
}

const calculators: Record<string, (params: any) => any> = {
  finchhand: calcFinchHand,
};

export default {
  async run(systemId: any, answers: any) {
    console.log('Calc service called:', { systemId, answers });

    const system = await (strapi as any).entityService.findOne(
      'api::system.system',
      systemId,
      {
        populate: {
          quest: {
            populate: ['fields'],
          },
          layers: true,
        },
      }
    );

    if (!system?.quest) {
      throw new Error('Quest not found');
    }

    const calcType = (system.quest as any).calctype;
    console.log('Calc type:', calcType);

    const calculator = calculators[calcType];
    if (!calculator) {
      throw new Error(`Unknown calctype: ${calcType}`);
    }

    return calculator({ system, answers });
  },
};