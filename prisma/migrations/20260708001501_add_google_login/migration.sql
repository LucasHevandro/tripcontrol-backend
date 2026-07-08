-- Torna a senha opcional (usuários que entram via Google não têm senha local)
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- Adiciona o vínculo com a conta Google
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;

-- Garante que um googleId não se repita entre usuários
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
