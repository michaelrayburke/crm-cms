const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const rows = await p.$queryRawUnsafe('select 1 as ok');
    console.log(rows);
  } catch (e) {
    console.error(e);
  } finally {
    await p.$disconnect();
  }
})();
