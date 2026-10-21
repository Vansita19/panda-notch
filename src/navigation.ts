// View IDs stay stable so calendar, task, and capture shortcuts keep their destinations.
export const featureViews=[
 {id:'tasks',title:'To-Do',tabLabel:'To-Do'},
 {id:'focus',title:'Focus',tabLabel:'Focus'},
 {id:'pins',title:'All links',tabLabel:'All links'},
 {id:'dump',title:'Ideas',tabLabel:'Ideas'},
 {id:'reminders',title:'Reminders',tabLabel:'Reminders'},
] as const;
export const navigationOptions=[{value:'today',label:'Menu'},...featureViews.map(view=>({value:view.id,label:view.tabLabel}))];
