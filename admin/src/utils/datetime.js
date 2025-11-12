
import { DateTime } from 'luxon'

export function combineDateAndTimeToUTC(dateISO, time, tz='America/Los_Angeles'){
  const [y,m,d]=dateISO.split('-').map(Number)
  let hh=0,mm=0,ss=0
  if (typeof time === 'string'){ [hh,mm,ss]=time.split(':').map(Number); ss=ss||0 }
  else { hh=Math.floor(time.minutes/60); mm=time.minutes%60; ss=time.seconds||0 }
  return DateTime.fromObject({ year:y, month:m, day:d, hour:hh, minute:mm, second:ss }, { zone: tz }).toUTC().toISO()
}

export function fmtDateTimeUTC(utcIso, tz='America/Los_Angeles', locale='en-US', opt={ dateStyle:'medium', timeStyle:'short' }){
  return new Intl.DateTimeFormat(locale, { ...opt, timeZone: tz }).format(new Date(utcIso))
}

export function fmtDateISO(iso, locale='en-US', style='long'){
  const [y,m,d]=iso.split('-').map(Number)
  const dt=new Date(Date.UTC(y,m-1,d))
  const map = { short:{dateStyle:'short'}, medium:{dateStyle:'medium'}, long:{dateStyle:'long'} }
  return new Intl.DateTimeFormat(locale, map[style] || map.long).format(dt)
}
