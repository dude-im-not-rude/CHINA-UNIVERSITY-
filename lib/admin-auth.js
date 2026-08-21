import crypto from "node:crypto";

const b64=(s)=>Buffer.from(s).toString("base64url");
const unb64=(s)=>Buffer.from(s,"base64url").toString();
const timingSafe=(a,b)=>{const A=Buffer.from(a);const B=Buffer.from(b);return A.length===B.length&&crypto.timingSafeEqual(A,B)};

export function verifyPassword(password, encoded){
  if(!encoded||!encoded.startsWith("pbkdf2$")) return false;
  const [,iterations,salt,hash]=encoded.split("$");
  const derived=crypto.pbkdf2Sync(password,salt,Number(iterations),64,"sha512").toString("hex");
  return timingSafe(derived,hash);
}

function hotp(secret,counter){
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits="";
  for(const c of secret.replace(/=+$/,"")){const n=alphabet.indexOf(c.toUpperCase());if(n<0) continue;bits+=n.toString(2).padStart(5,"0")}
  const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
  const msg=Buffer.alloc(8);let x=BigInt(counter);for(let i=7;i>=0;i--){msg[i]=Number(x&255n);x>>=8n}
  const key=Buffer.from(bytes);const digest=crypto.createHmac("sha1",key).update(msg).digest();const offset=digest[digest.length-1]&15;
  const code=((digest[offset]&127)<<24|(digest[offset+1]&255)<<16|(digest[offset+2]&255)<<8|(digest[offset+3]&255))%1000000;
  return String(code).padStart(6,"0");
}

export function verifyTotp(code,secret){
  if(!secret||!/^\d{6}$/.test(code||"")) return false;
  const step=Math.floor(Date.now()/1000/30);
  for(let drift=-1;drift<=1;drift++) if(hotp(secret,step+drift)===code) return true;
  return false;
}

function sign(payload){return b64(payload)+"."+b64(crypto.createHmac("sha256",process.env.ADMIN_SESSION_SECRET||"").update(payload).digest())}
export function createSession(email){
  const payload=JSON.stringify({email,role:"admin",exp:Date.now()+1000*60*60*8,nonce:crypto.randomBytes(12).toString("hex")});
  return sign(payload);
}
export function readSession(token){
  try{
    if(!token||!process.env.ADMIN_SESSION_SECRET) return null;
    const [payload,sig]=token.split(".");
    const expected=b64(crypto.createHmac("sha256",process.env.ADMIN_SESSION_SECRET).update(unb64(payload)).digest());
    if(!timingSafe(sig,expected)) return null;
    const data=JSON.parse(unb64(payload));
    if(data.role!=="admin"||data.exp<Date.now()) return null;
    return data;
  }catch{return null}
}
