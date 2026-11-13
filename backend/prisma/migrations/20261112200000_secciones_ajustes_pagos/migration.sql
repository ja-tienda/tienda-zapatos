-- Migración escrita a partir de `prisma migrate diff`, ajustada a mano para CONSERVAR los datos:
--   · MUJER/HOMBRE pasan a DAMA/CABALLERO (se agregan NINO y NINA)
--   · La categoría fija (enum) se convierte en la tabla "Section", editable desde el panel

-- CreateEnum
CREATE TYPE "SectionKind" AS ENUM ('CATEGORIA', 'COLECCION');

-- CreateEnum
CREATE TYPE "SizeType" AS ENUM ('CALZADO', 'ROPA', 'UNICA');

-- AlterEnum (con conversión de los valores antiguos)
BEGIN;
CREATE TYPE "Gender_new" AS ENUM ('NINO', 'NINA', 'DAMA', 'CABALLERO', 'UNISEX');
ALTER TABLE "public"."Product" ALTER COLUMN "gender" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "gender" TYPE "Gender_new" USING (
  CASE "gender"::text
    WHEN 'MUJER' THEN 'DAMA'
    WHEN 'HOMBRE' THEN 'CABALLERO'
    ELSE "gender"::text
  END::"Gender_new"
);
ALTER TYPE "Gender" RENAME TO "Gender_old";
ALTER TYPE "Gender_new" RENAME TO "Gender";
DROP TYPE "public"."Gender_old";
ALTER TABLE "Product" ALTER COLUMN "gender" SET DEFAULT 'UNISEX';
COMMIT;

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'TARJETA';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentRef" TEXT,
ADD COLUMN     "publicToken" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "receiptUrl" TEXT,
ALTER COLUMN "paymentMethod" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Section" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "SectionKind" NOT NULL,
    "sizeType" "SizeType" NOT NULL DEFAULT 'UNICA',
    "coverImage" TEXT,
    "heroTitle" TEXT NOT NULL DEFAULT '',
    "heroText" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT 'Ver productos',
    "showInCarousel" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Section_slug_key" ON "Section"("slug");

-- CreateIndex
CREATE INDEX "Section_kind_isActive_idx" ON "Section"("kind", "isActive");

-- Las tres categorías que antes eran fijas ("Zapatillas" pasa a llamarse "Calzados")
INSERT INTO "Section" ("name", "slug", "kind", "sizeType", "heroTitle", "heroText", "ctaLabel", "sortOrder") VALUES
  ('Calzados', 'calzados', 'CATEGORIA', 'CALZADO', 'Calzados para cada paso', 'Zapatillas en tendencia con stock real por talla.', 'Ver calzados', 1),
  ('Ropa', 'ropa', 'CATEGORIA', 'ROPA', 'Ropa para todos los días', 'Prendas cómodas que combinan con tus zapatillas favoritas.', 'Ver ropa', 2),
  ('Accesorios', 'accesorios', 'CATEGORIA', 'UNICA', 'Accesorios que completan tu look', 'Bolsos, gorras, medias y más.', 'Ver accesorios', 3);

-- Product.category (enum) -> Product.categoryId (relación), copiando el valor de cada producto
ALTER TABLE "Product" ADD COLUMN "categoryId" INTEGER;

UPDATE "Product" p
SET "categoryId" = s."id"
FROM "Section" s
WHERE s."slug" = CASE p."category"::text
  WHEN 'ZAPATILLAS' THEN 'calzados'
  WHEN 'ROPA' THEN 'ropa'
  ELSE 'accesorios'
END;

ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- DropIndex
DROP INDEX "Product_category_idx";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "category";

-- DropEnum
DROP TYPE "Category";

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_ProductCollections" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProductCollections_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProductCollections_B_index" ON "_ProductCollections"("B");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductCollections" ADD CONSTRAINT "_ProductCollections_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductCollections" ADD CONSTRAINT "_ProductCollections_B_fkey" FOREIGN KEY ("B") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
