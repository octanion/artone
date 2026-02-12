export default {
  async run(ctx: any) {
    try {
      const { artsystemId, answers } = ctx.request.body;

      const result = await (strapi as any)
        .service("api::calc.calc")
        .run(artsystemId, answers);

      ctx.body = result;
    } catch (error) {
      ctx.throw(400, (error as any).message);
    }
  },
};
