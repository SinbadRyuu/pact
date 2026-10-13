import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existingDefault = await prisma.broker.findFirst({ where: { isDefault: true } });
  if (existingDefault) {
    console.log(`Default broker already exists: ${existingDefault.name} (${existingDefault.id})`);
    return;
  }

  const broker = await prisma.broker.create({
    data: {
      name: "VTM",
      signupUrl: "https://vtm.pro/la5-com/global/WXb1zNt0",
      minDepositAmount: 300,
      minDepositCurrency: "£",
      isActive: true,
      isDefault: true,
    },
  });

  console.log(`Created default broker: ${broker.name} (${broker.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
