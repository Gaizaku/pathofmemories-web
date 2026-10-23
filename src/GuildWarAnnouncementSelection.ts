type AnnouncementRound = {id:string;starts_at:string;local_date?:string};

function localDate(round:AnnouncementRound) {
  return round.local_date || new Date(new Date(round.starts_at).getTime()+7*3600000).toISOString().slice(0,10);
}

export function announcementRoundsForDay(rounds:AnnouncementRound[],selectedId:string):string[] {
  const selected=rounds.find(round=>round.id===selectedId)||rounds[0];
  if(!selected)return [];
  const day=localDate(selected);
  return rounds.filter(round=>localDate(round)===day)
    .sort((left,right)=>Date.parse(left.starts_at)-Date.parse(right.starts_at))
    .slice(0,4).map(round=>round.id);
}
