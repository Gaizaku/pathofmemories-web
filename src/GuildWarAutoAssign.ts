export type AutoLoadout = {id:string; role:string};
export type AutoPlayer = {player_id:string; preferred_team?:string; preferred_role?:string; loadouts:AutoLoadout[]};
export type AutoPlacement = {team:string; loadout:string; position?:number; jungle?:string; tower?:string; towerPosition?:number};

const combatTeams = ["ATTACK_1","ATTACK_2","ATTACK_3","DEFENSE_1","DEFENSE_2","FOREST"];
const teamCapacity = 5;

function selectedRole(player:AutoPlayer, placement:AutoPlacement|undefined) {
  return player.loadouts.find(loadout=>loadout.id===placement?.loadout)?.role || player.preferred_role || player.loadouts[0]?.role || "";
}

function chooseLoadout(player:AutoPlayer, role:string) {
  return player.loadouts.find(loadout=>loadout.role===role)?.id
    || player.loadouts.find(loadout=>loadout.role===player.preferred_role)?.id
    || player.loadouts[0]?.id
    || "";
}

function nextPosition(board:Record<string,AutoPlacement>, team:string) {
  return Object.values(board).filter(placement=>placement.team===team).reduce((highest,placement)=>Math.max(highest,placement.position ?? -1),-1)+1;
}

function takeCandidate(candidates:AutoPlayer[], team:string, role:string, onlyPreferred=false) {
  const score = (player:AutoPlayer) => {
    const preference = player.preferred_team === team ? 3 : !player.preferred_team ? 2 : 1;
    const roleMatch = role && player.loadouts.some(loadout=>loadout.role===role) ? 10 : 0;
    return roleMatch + preference;
  };
  let index = -1, best = -1;
  candidates.forEach((player,current)=>{
    if(onlyPreferred&&player.preferred_team!==team) return;
    const value=score(player);
    if(value>best){best=value;index=current;}
  });
  return index<0 ? undefined : candidates.splice(index,1)[0];
}

/**
 * Fills only players that the organizer has not placed manually.
 * It respects an exact team request first, uses Tank and Heal when available,
 * then fills squads in a compact order and sends any overflow to Standby.
 */
export function autoAssignUnassigned(players:AutoPlayer[], current:Record<string,AutoPlacement>) {
  const board:Record<string,AutoPlacement>={...current};
  const candidates=players.filter(player=>!board[player.player_id]);
  const initialCount=candidates.length;

  // Keep every exact team request before using flexible players to complete a squad.
  for(const team of combatTeams) {
    const members=()=>players.filter(player=>board[player.player_id]?.team===team);
    while(members().length<teamCapacity) {
      const missingRole=["Tank","Heal"].find(requiredRole=>!members().some(player=>selectedRole(player,board[player.player_id])===requiredRole)) || "";
      const player=takeCandidate(candidates,team,missingRole,true) || takeCandidate(candidates,team,"",true);
      if(!player) break;
      board[player.player_id]={team,loadout:chooseLoadout(player,missingRole),position:nextPosition(board,team)};
    }
  }

  // Complete squads that already have a requested member before opening a new one.
  for(const team of combatTeams.filter(team=>players.some(player=>board[player.player_id]?.team===team))) {
    const members=()=>players.filter(player=>board[player.player_id]?.team===team);
    for(const requiredRole of ["Tank","Heal"]) {
      if(members().length>=teamCapacity || members().some(player=>selectedRole(player,board[player.player_id])===requiredRole)) continue;
      const player=takeCandidate(candidates,team,requiredRole);
      if(!player) continue;
      board[player.player_id]={team,loadout:chooseLoadout(player,requiredRole),position:nextPosition(board,team)};
    }
    while(members().length<teamCapacity && candidates.length) {
      const player=takeCandidate(candidates,team,"");
      if(!player) break;
      board[player.player_id]={team,loadout:chooseLoadout(player,""),position:nextPosition(board,team)};
    }
  }

  // If no preference selected a team, use compact full squads in the normal board order.
  for(const team of combatTeams.filter(team=>!players.some(player=>board[player.player_id]?.team===team))) {
    const members=()=>players.filter(player=>board[player.player_id]?.team===team);
    for(const requiredRole of ["Tank","Heal"]) {
      if(members().length>=teamCapacity) break;
      const player=takeCandidate(candidates,team,requiredRole);
      if(!player) continue;
      board[player.player_id]={team,loadout:chooseLoadout(player,requiredRole),position:nextPosition(board,team)};
    }
    while(members().length<teamCapacity&&candidates.length) {
      const player=takeCandidate(candidates,team,"");
      if(!player) break;
      board[player.player_id]={team,loadout:chooseLoadout(player,""),position:nextPosition(board,team)};
    }
  }

  for(const player of candidates) {
    board[player.player_id]={team:"STANDBY",loadout:chooseLoadout(player,""),position:nextPosition(board,"STANDBY")};
  }
  return {board,assigned:initialCount-candidates.length,standby:candidates.length};
}
