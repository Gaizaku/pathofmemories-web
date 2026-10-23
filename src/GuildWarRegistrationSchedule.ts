export function reconcileRegistrationRounds(current:string[],previousVisible:string[],nextVisible:string[],latestSelected:string[]):string[] {
  const selected=new Set(current),previous=new Set(previousVisible),latest=new Set(latestSelected);
  // Restore saved choices only for newly visible rounds; keep pending edits to rounds already shown.
  return nextVisible.filter(id=>selected.has(id)||!previous.has(id)&&latest.has(id));
}
