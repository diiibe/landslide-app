export function exportReport(id:string, data:unknown) {
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download=`friulview-${id}-ipotesi.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
