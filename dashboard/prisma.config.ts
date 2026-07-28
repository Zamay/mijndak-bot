import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  migrate: {
    connection: {
      url: process.env.DATABASE_URL,
    },
  },
})
