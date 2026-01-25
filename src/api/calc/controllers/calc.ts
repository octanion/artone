export default {
  async run(ctx: any) {
    try {
      const { systemId, answers } = ctx.request.body;
      const result = await (strapi as any).service('api::calc.calc').run(systemId, answers);
      ctx.body = result;
    } catch (error) {
      ctx.throw(400, (error as any).message);
    }
  },
};
