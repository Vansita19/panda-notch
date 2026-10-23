const size=value=>Number.isFinite(value)&&value>=0?value:0;

// The calendar may retain its expanded flow box while only the compact panel is painted.
export function plannerCompactHeight({panelHeight,workspaceHeight,headingHeight,headingGap,listHeight,minimumListHeight=0,availableHeight,manualHeight}){
 const chrome=Math.max(0,size(panelHeight)-size(workspaceHeight));
 const content=chrome+size(headingHeight)+size(headingGap)+Math.max(size(listHeight),size(minimumListHeight));
 const target=Number.isFinite(manualHeight)&&manualHeight>=0?manualHeight:content;
 const limit=Number.isFinite(availableHeight)&&availableHeight>=0?availableHeight:Infinity;
 return Math.min(limit,Math.ceil(target));
}
