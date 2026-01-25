export default {
  routes: [
    {
      method: 'POST',
      path: '/calc',
      handler: 'calc.run',
      config: { auth: false },
    },
  ],
};