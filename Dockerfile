# Gunakan node:20-slim sebagai base image yang ringan
FROM node:22-slim

# Set working directory
WORKDIR /app

# Install pnpm secara global
RUN npm install -g pnpm@11.5.1

# Salin package.json dan pnpm-lock.yaml (jika ada) untuk instalasi dependency dahulu (caching)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies (termasuk kompilasi native modules)
RUN pnpm install

# Salin semua file proyek ke working directory
COPY . .

# Build frontend
RUN cd frontend && npm install && npm run build

# Ekspos port dashboard (default: 3000)
EXPOSE 3000

# Jalankan bot beserta dashboard
CMD ["node", "index.js"]
