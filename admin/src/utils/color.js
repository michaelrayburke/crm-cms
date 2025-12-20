
export function normalizeHex(input){
  let s=String(input).trim().toLowerCase(); if (s.startsWith('#')) s=s.slice(1)
  if (s.length===3) s=s.split('').map(c=>c+c).join('')
  if (!/^[0-9a-f]{6}$/.test(s)) throw new Error('Invalid hex')
  return '#'+s
}

export function contrastRatio(hex1, hex2){
  const lum=(hex)=>{ const c=hex.replace('#','')
    const r=parseInt(c.slice(0,2),16)/255
    const g=parseInt(c.slice(2,4),16)/255
    const b=parseInt(c.slice(4,6),16)/255
    const f=(x)=> x<=.03928? x/12.92 : Math.pow((x+0.055)/1.055,2.4)
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
  }
  const L1=lum(hex1), L2=lum(hex2); const hi=Math.max(L1,L2)+.05, lo=Math.min(L1,L2)+.05
  return +(hi/lo).toFixed(2)
}
