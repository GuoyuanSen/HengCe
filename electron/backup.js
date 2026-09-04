const crypto = require("crypto");

const FORMAT = "hengce-local-backup";
const VERSION = 1;

function parseObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") throw new Error("备份文件格式无效");
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("备份文件格式无效");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("备份文件格式无效");
  return parsed;
}

function deriveKey(password, salt) {
  return crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
}

function createBackupEnvelope(payload, password = "", now = new Date()) {
  const data = parseObject(payload);
  const createdAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  if (!password) return { format: FORMAT, version: VERSION, encrypted: false, createdAt, data };
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return {
    format: FORMAT,
    version: VERSION,
    encrypted: true,
    createdAt,
    algorithm: "aes-256-gcm+scrypt",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64")
  };
}

function openBackupEnvelope(value, password = "") {
  const envelope = parseObject(value);
  if (envelope.format !== FORMAT || envelope.version !== VERSION) throw new Error("不是可识别的衡策备份文件");
  if (!envelope.encrypted) return parseObject(envelope.data);
  if (!password) throw new Error("该备份已加密，请输入备份密码");
  try {
    const salt = Buffer.from(String(envelope.salt || ""), "base64");
    const iv = Buffer.from(String(envelope.iv || ""), "base64");
    const tag = Buffer.from(String(envelope.tag || ""), "base64");
    const encrypted = Buffer.from(String(envelope.data || ""), "base64");
    if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16 || !encrypted.length) throw new Error("invalid");
    const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(password, salt), iv);
    decipher.setAuthTag(tag);
    const clear = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return parseObject(clear);
  } catch {
    throw new Error("备份密码错误或文件已损坏");
  }
}

module.exports = { FORMAT, VERSION, createBackupEnvelope, openBackupEnvelope };
