-- CreateTable
CREATE TABLE "instructor_followers" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_followers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instructor_followers_followerId_idx" ON "instructor_followers"("followerId");

-- CreateIndex
CREATE INDEX "instructor_followers_instructorId_idx" ON "instructor_followers"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_followers_followerId_instructorId_key" ON "instructor_followers"("followerId", "instructorId");

-- AddForeignKey
ALTER TABLE "instructor_followers" ADD CONSTRAINT "instructor_followers_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_followers" ADD CONSTRAINT "instructor_followers_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
