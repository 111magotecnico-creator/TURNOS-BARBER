const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.settings.update({ where: { id: "default" }, data: { shopName: "BARBERS" } })
  .then(() => console.log("OK: shopName = BARBERS"))
  .catch(e => console.error(e))
  .finally(() => p.$disconnect());
