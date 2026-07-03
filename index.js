require('dotenv').config();

// Patch minecraft-data to automatically append restBuffer to teleport and sync packet definitions
try {
  const mcDataPath = require.resolve('minecraft-data');
  const originalMcData = require(mcDataPath);
  const patchedExport = function (version) {
    const data = originalMcData(version);
    if (data && data.protocol && data.protocol.play && data.protocol.play.toClient) {
      try {
        const types = data.protocol.play.toClient.types;
        if (types) {
          for (const key of Object.keys(types)) {
            if ((key.includes('teleport') || key.includes('sync')) && Array.isArray(types[key])) {
              const typeDef = types[key];
              if (typeDef[0] === 'container' && Array.isArray(typeDef[1])) {
                const fields = typeDef[1];
                const hasEntityId = fields.some(f => f.name === 'entityId');
                const hasX = fields.some(f => f.name === 'x');
                const hasZ = fields.some(f => f.name === 'z');
                if (hasEntityId && hasX && hasZ) {
                  const hasRest = fields.some(f => f.name === 'rest' || f.type === 'restBuffer');
                  if (!hasRest) {
                    fields.push({
                      name: 'rest',
                      type: 'restBuffer'
                    });
                    console.log(`[🔧 Protocol Patch] Berhasil menambal protocol untuk "${key}" di minecraft-data.`);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[❌ Protocol Patch] Gagal menambal protocol:', err.message);
      }
    }
    return data;
  };
  Object.assign(patchedExport, originalMcData);
  require.cache[mcDataPath].exports = patchedExport;
} catch (e) {
  console.error('[⚠️ Patch] Gagal mem-patch minecraft-data:', e.message);
}

// Monkey-patch prismarine-nbt to prevent crash on undefined properties during dimension codec load
const nbt = require('prismarine-nbt');
const originalSimplify = nbt.simplify;
nbt.simplify = function simplify (data) {
  if (data === undefined || data === null) return undefined;
  function transform (value, type) {
    if (type === 'compound') {
      if (value === undefined || value === null) return {};
      return Object.keys(value).reduce(function (acc, key) {
        acc[key] = simplify(value[key])
        return acc
      }, {})
    }
    if (type === 'list') {
      if (value === undefined || value === null || !value.value) return [];
      return value.value.map(function (v) { return transform(v, value.type) })
    }
    return value;
  }
  return transform(data.value, data.type);
};

// Monkey-patch prismarine-registry transforms to handle biomes with missing element/properties gracefully
const transforms = require('prismarine-registry/lib/pc/transforms');
transforms.networkBiomesToMcDataSchema = function (biome, staticData) {
  if (!biome) return {};
  const name = biome.name ? biome.name.replace('minecraft:', '') : '';
  const equivalent = (staticData && staticData.biomesByName && staticData.biomesByName[name]) || {};
  if (!biome.element) {
    biome.element = {};
  }
  return Object.assign(biome.element, {
    ...equivalent,
    id: biome.id,
    name,
    category: biome.element.category ?? equivalent.category,
    temperature: biome.element.temperature ?? equivalent.temperature,
    depth: biome.element.depth ?? equivalent.depth,
    scale: biome.element.scale ?? equivalent.scale,
    precipitation: biome.element.precipitation ?? equivalent.precipitation,
    rainfall: biome.element.downfall ?? equivalent.rainfall
  });
};

// Monkey-patch prismarine-registry pc index to intercept loadDimensionCodec and inject safe fallbacks for missing entry values
try {
  const pcRegistryPath = require.resolve('prismarine-registry/lib/pc/index');
  const originalPcRegistry = require(pcRegistryPath);
  require.cache[pcRegistryPath].exports = function (data, staticData) {
    const registry = originalPcRegistry(data, staticData);
    const originalLoad = registry.loadDimensionCodec;
    if (originalLoad) {
      registry.loadDimensionCodec = function (codec) {
        if (codec && codec.entries) {
          const registryName = codec.id ? codec.id.replace('minecraft:', '') : '';
          for (const entry of codec.entries) {
            if (registryName === 'dimension_type') {
              if (!entry.value || entry.value.value === undefined) {
                const n = entry.key.replace('minecraft:', '');
                const equivalent = (staticData && staticData.dimensionsByName?.[n]) || {};
                entry.value = {
                  type: 'compound',
                  value: {
                    min_y: { type: 'int', value: equivalent.minY ?? 0 },
                    height: { type: 'int', value: equivalent.height ?? 256 }
                  }
                };
              }
            } else if (registryName === 'worldgen/biome') {
              if (!entry.value || entry.value.value === undefined) {
                const n = entry.key.replace('minecraft:', '');
                const equivalent = (staticData && staticData.biomesByName?.[n]) || {};
                entry.value = {
                  type: 'compound',
                  value: {
                    category: { type: 'string', value: equivalent.category ?? 'none' },
                    temperature: { type: 'float', value: equivalent.temperature ?? 0.5 },
                    downfall: { type: 'float', value: equivalent.rainfall ?? 0.5 }
                  }
                };
              }
            } else {
              if (!entry.value || entry.value.value === undefined) {
                entry.value = { type: 'compound', value: {} };
              }
            }
          }
        }
        return originalLoad.call(this, codec);
      };
    }

    // Patch entity teleport and sync packets to consume trailing bytes (fixes "Chunk size is 67 but only 33 was read" error)
    try {
      if (registry.protocol && registry.protocol.play && registry.protocol.play.toClient) {
        const types = registry.protocol.play.toClient.types;
        if (types) {
          for (const key of Object.keys(types)) {
            if ((key.includes('teleport') || key.includes('sync')) && Array.isArray(types[key])) {
              const typeDef = types[key];
              if (typeDef[0] === 'container' && Array.isArray(typeDef[1])) {
                const fields = typeDef[1];
                const hasEntityId = fields.some(f => f.name === 'entityId');
                const hasX = fields.some(f => f.name === 'x');
                const hasZ = fields.some(f => f.name === 'z');
                if (hasEntityId && hasX && hasZ) {
                  const hasRest = fields.some(f => f.name === 'rest' || f.type === 'restBuffer');
                  if (!hasRest) {
                    fields.push({
                      name: 'rest',
                      type: 'restBuffer'
                    });
                    console.log(`[🔧 Patch] Berhasil menambal packet definition untuk "${key}" dengan restBuffer.`);
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[❌ Patch] Gagal menambal packet teleport/sync:', err.message);
    }

    return registry;
  };
} catch (e) {
  console.error('[⚠️ Patch] Gagal mem-patch prismarine-registry/lib/pc/index:', e.message);
}

// Monkey-patch prismarine-chunk to allow bitsPerBiome up to 16 (resolving Bits per biome is too big: 10 error on 1.21.4 servers)
try {
  const PaletteBiome = require('prismarine-chunk/src/pc/common/PaletteBiome');
  const constants = require('prismarine-chunk/src/pc/common/constants');
  const { SingleValueContainer, IndirectPaletteContainer, DirectPaletteContainer } = require('prismarine-chunk/src/pc/common/PaletteContainer');
  const varInt = require('prismarine-chunk/src/pc/common/varInt');

  PaletteBiome.read = function (smartBuffer, maxBitsPerBiome = constants.GLOBAL_BITS_PER_BIOME, noSizePrefix) {
    const bitsPerBiome = smartBuffer.readUInt8();
    // Allow up to 16 bits per biome
    if (bitsPerBiome > 16) throw new Error(`Bits per biome is too big: ${bitsPerBiome}`);

    // Case 1: Single Value Container (all biomes in the section are the same)
    if (bitsPerBiome === 0) {
      const section = new PaletteBiome({
        noSizePrefix,
        singleValue: varInt.read(smartBuffer)
      });
      if (!noSizePrefix) smartBuffer.readUInt8();
      return section;
    }

    // Case 2: Direct Palette (global palette)
    if (bitsPerBiome > constants.MAX_BITS_PER_BIOME) {
      return new PaletteBiome({
        noSizePrefix,
        data: new DirectPaletteContainer({
          noSizePrefix,
          bitsPerValue: maxBitsPerBiome,
          capacity: constants.BIOME_SECTION_VOLUME
        }).readBuffer(smartBuffer, bitsPerBiome)
      });
    }

    // Case 3: Indirect Palette (local palette)
    const palette = [];
    const paletteLength = varInt.read(smartBuffer);
    for (let i = 0; i < paletteLength; ++i) {
      palette.push(varInt.read(smartBuffer));
    }

    return new PaletteBiome({
      data: new IndirectPaletteContainer({
        noSizePrefix,
        bitsPerValue: bitsPerBiome,
        capacity: constants.BIOME_SECTION_VOLUME,
        maxBits: constants.MAX_BITS_PER_BIOME,
        palette
      }).readBuffer(smartBuffer, bitsPerBiome)
    });
  };
} catch (e) {
  console.error('[⚠️ Patch] Gagal mem-patch prismarine-chunk PaletteBiome:', e.message);
}

const mf = require('mineflayer');
const velocityFix = require('./velocity-fix.js');
const express = require('express');
const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, 'config.json');

function loadConfig() {
    const defaults = {
        host: '',
        username: '',
        auth: 'offline',
        version: process.env.MINECRAFT_VERSION || '1.21.4',
        brand: 'vanilla',
        password: process.env.PASSWORD || '',
        startupCommands: [
            '/server sveco'
        ],
        autoReplies: [
            {
                trigger: '/login',
                response: '/login {password}'
            }
        ]
    };
    try {
        if (fs.existsSync(configPath)) {
            const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return Object.assign({}, defaults, loaded);
        }
    } catch (err) {
        console.error('Gagal membaca config.json:', err.message);
    }
    saveConfig(defaults);
    return defaults;
}

function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Gagal menyimpan config.json:', err.message);
        return false;
    }
}

// Global Fail-Safe Error Handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('[❌ Unhandled Rejection]:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[❌ Uncaught Exception]:', err);
});

// Logs capturing system
const logBuffer = [];
const logLimit = 100;
const sseClients = new Set();

function addLog(type, text) {
    const logEntry = {
        time: new Date().toLocaleTimeString(),
        type: type,
        text: text
    };
    logBuffer.push(logEntry);
    if (logBuffer.length > logLimit) {
        logBuffer.shift();
    }
    const sseData = `data: ${JSON.stringify(logEntry)}\n\n`;
    sseClients.forEach(res => res.write(sseData));
}

const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    const text = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    originalLog.apply(console, args);
    addLog('info', text);
};

console.error = (...args) => {
    const text = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    originalError.apply(console, args);
    addLog('error', text);
};


let bot = null;
let isTransferring = false;
let reconnectTimeout = null;

function initBot() {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    const config = loadConfig();
    console.log('🔄 [Tahap 1] Memulai koneksi bot ke server...');
    bot = mf.createBot({
        host: config.host || 'marlinmc.icu',
        username: config.username || 'Seranjanah',
        auth: config.auth || 'offline',
        version: config.version || '1.21.4',
        brand: config.brand || 'vanilla',
    });

    bot.loadPlugin(velocityFix);

    bot.on('connect', () => {
        console.log('🔄 [Tahap 2] Terhubung ke jaringan server...');

        // Register client packets listeners safely inside 'connect'
        bot._client.on('start_configuration', () => {
            console.log('[🔄] Proxy memulai transfer! Membius total fisik bot...');
            isTransferring = true;
            bot.physicsEnabled = false; 
            if (bot.pathfinder) bot.pathfinder.stop();
            bot.clearControlStates();
        });

        bot._client.on('finish_configuration', () => {
            console.log('[✅] Konfigurasi selesai, bersiap masuk ke world!');
        });

        bot._client.on('add_resource_pack', (data) => {
            if (bot.inConfigurationPhase) return;
            console.log(`[🎨] Server memaksa Resource Pack! Membalas 'ACCEPTED'...`);
            try {
                bot._client.write('resource_pack_receive', {
                    uuid: data.uuid,
                    result: 3 // ACCEPTED
                });
                setTimeout(() => {
                    if (bot._ended) return;
                    console.log(`[🎨] Simulasi Resource Pack selesai diunduh (DOWNLOADED)...`);
                    bot._client.write('resource_pack_receive', {
                        uuid: data.uuid,
                        result: 4 // DOWNLOADED
                    });
                    setTimeout(() => {
                        if (bot._ended) return;
                        console.log(`[🎨] Simulasi Resource Pack berhasil dimuat (SUCCESSFULLY_LOADED)...`);
                        bot._client.write('resource_pack_receive', {
                            uuid: data.uuid,
                            result: 0 // SUCCESSFULLY_LOADED
                        });
                    }, 250);
                }, 250); 
            } catch (err) {
                console.log('[❌] Gagal membalas paket resource_pack:', err.message);
            }
        });
    });

    bot.on('login', () => {
        console.log('Bot Login');
    });

    let startupExecuted = false;
    bot.on('spawn', () => {
        if (isTransferring) {
            console.log('[🎉] Bot berhasil mendarat di server Survival!');
            bot.physicsEnabled = true; 
            isTransferring = false;
        } else {
            console.log('[+] Bot berhasil login ke Lobby.');
            
            if (!startupExecuted) {
                startupExecuted = true;
                const config = loadConfig();
                if (config.startupCommands && config.startupCommands.length > 0) {
                    console.log('[Startup] Menjalankan startup commands...');
                    config.startupCommands.forEach((cmd, idx) => {
                        setTimeout(() => {
                            if (bot && !bot._ended) {
                                const actualCmd = cmd.replace('{password}', config.password || '');
                                bot.chat(actualCmd);
                                console.log(`[Startup] Menjalankan: ${actualCmd}`);
                            }
                        }, 1500 * (idx + 1));
                    });
                }
            }
        }
    });

    bot.on('message', (jsonMsg) => {
        const msgText = jsonMsg.toString();
        if (msgText.trim()) {
            console.log(msgText);
        }
        const config = loadConfig();
        if (config.autoReplies && Array.isArray(config.autoReplies)) {
            for (const reply of config.autoReplies) {
                if (reply.trigger && msgText.includes(reply.trigger)) {
                    const response = reply.response || '';
                    if (response) {
                        const actualResponse = response.replace('{password}', config.password || '');
                        console.log(`[AutoReply] Memicu kata kunci "${reply.trigger}". Mengirim: ${actualResponse}`);
                        setTimeout(() => {
                            if (bot && !bot._ended) {
                                bot.chat(actualResponse);
                            }
                        }, 1000);
                        break;
                    }
                }
            }
        }
    });

    bot.on('move', () => {
        if (!bot.entity || !bot.entity.position) return;
        const y = bot.entity.position.y;
        if (y <= -100) {
            if (bot._ended || isTransferring) return;
            console.log(`[⚠️] Bot mendeteksi koordinat Y berada di void (${Math.round(y)}). Melakukan relog instan...`);
            reconnectBot('Reconnecting via Void Safe');
        }
    });

    bot.on('death', () => {
        console.log('Bot mati, mencoba respawn...');
    });

    bot.on('kicked', (reason, loggedIn) => {
        const alasanDetail = JSON.stringify(reason, null, 2);
        console.log(`[⚠️] Bot di-kick dari server! Alasan: ${alasanDetail}`);
    });

    bot.on('end', (reason) => {
        console.log(`[⚠️] Koneksi terputus! Alasan: ${reason}`);
        
        // Auto reconnect logic
        if (reason !== 'Disconnected via Dashboard' && reason !== 'Reconnecting via Dashboard' && reason !== 'Reconnecting via Void Safe') {
            console.log('[🔄] Mencoba menyambung kembali secara otomatis dalam 10 detik...');
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
                initBot();
            }, 10000);
        }
    });

    bot.on('error', (err) => {
        console.log(`[❌] Terjadi Error pada Bot:`, err.message);
    });
}

function reconnectBot(reason = 'Reconnecting via Dashboard') {
    console.log(`[Dashboard] Melakukan reset koneksi bot (${reason})...`);
    if (bot) {
        try {
            bot.end(reason);
        } catch (e) {}
    }
    setTimeout(() => {
        initBot();
    }, 2000);
}

// Start bot
initBot();

// Express Server
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send existing logs
    logBuffer.forEach(log => {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
    });

    sseClients.add(res);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

app.get('/api/status', (req, res) => {
    const isOnline = bot && bot._client && bot._client.state === 'play';
    res.json({
        online: isOnline,
        username: bot ? bot.username : 'Offline',
        server: isTransferring ? 'Transferring...' : (bot && bot._client ? (bot._client.state === 'play' ? 'Survival / sveco' : 'Configuration') : 'Offline'),
        health: bot ? (bot.health !== undefined ? bot.health : null) : null,
        food: bot ? (bot.food !== undefined ? bot.food : null) : null,
        position: bot && bot.entity ? {
            x: Math.round(bot.entity.position.x),
            y: Math.round(bot.entity.position.y),
            z: Math.round(bot.entity.position.z)
        } : null
    });
});

app.post('/api/send', (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    if (!bot || !bot._client || bot._client.state !== 'play') {
        return res.status(400).json({ error: 'Bot offline / tidak berada di dalam permainan' });
    }

    try {
        bot.chat(message);
        console.log(`[Dashboard] Chat terkirim: ${message}`);
        res.json({ success: true });
    } catch (err) {
        console.error('[Dashboard] Gagal mengirim pesan:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/control', (req, res) => {
    const { action } = req.body;
    if (action === 'reconnect') {
        reconnectBot();
        res.json({ success: true });
    } else if (action === 'disconnect') {
        console.log('[Dashboard] Memutuskan koneksi bot secara manual...');
        if (bot) {
            bot.end('Disconnected via Dashboard');
        }
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid action' });
    }
});

app.get('/api/config', (req, res) => {
    res.json(loadConfig());
});

app.post('/api/config', (req, res) => {
    const { host, username, auth, version, brand, password, startupCommands, autoReplies } = req.body;
    if (!host || !username || !version) {
        return res.status(400).json({ error: 'Host, Username, dan Version wajib diisi.' });
    }
    const newConfig = {
        host,
        username,
        auth: auth || 'offline',
        version,
        brand: brand || 'vanilla',
        password: password || '',
        startupCommands: Array.isArray(startupCommands) ? startupCommands : [],
        autoReplies: Array.isArray(autoReplies) ? autoReplies : []
    };
    if (saveConfig(newConfig)) {
        console.log('[Config] Konfigurasi berhasil disimpan. Melakukan reconnect otomatis...');
        res.json({ success: true, config: newConfig });
        setTimeout(() => {
            reconnectBot('Reconnecting via Config Save');
        }, 1000);
    } else {
        res.status(500).json({ error: 'Gagal menyimpan konfigurasi.' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Dashboard Server] Dashboard berjalan di http://localhost:${PORT}`);
});