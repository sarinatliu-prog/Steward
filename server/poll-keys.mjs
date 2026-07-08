const id=process.env.ALPACA_API_KEY_ID, sec=process.env.ALPACA_API_SECRET_KEY;
const basic="Basic "+Buffer.from(id+":"+sec).toString("base64");
const url="https://broker-api.sandbox.alpaca.markets/v1/accounts";
for(let i=1;i<=15;i++){
  try{
    const r=await fetch(url,{headers:{Authorization:basic,Accept:"application/json"}});
    const t=new Date().toISOString().slice(11,19);
    if(r.status===200){ console.log(`[${t}] attempt ${i}: 200 ✓✓✓ KEYS ARE LIVE`); process.exit(0); }
    console.log(`[${t}] attempt ${i}: ${r.status} (still propagating)`);
  }catch(e){ console.log("err",e.message); }
  if(i<15) await new Promise(r=>setTimeout(r,120000)); // 2 min
}
console.log("Still 401 after 30 min — this is an Alpaca-side issue; time for support.");
process.exit(1);
