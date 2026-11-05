#!/usr/bin/env python3
"""Original recipe/config fields + explicit local desktop balance adaptations."""
import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[2];data=json.loads((root/'research/references/restaurant/port-feasibility.json').read_text())
recipes=[]
for r in data['recipes']:
 price=int(r['Price']);level=r['Condition'] if r['Condition']<=60 else 4
 recipes.append(dict(id=r['ID'],name=r['Name'],level=level,cost=price or max(10,math.floor(r['Count']*r['SellPrice']*.5)),servings=r['Count'],sell=r['SellPrice'],cookMs=r['NeedTimer']*1000,freshMs=r['Timeout']*1000,originalSeconds=r['NeedTimer'],originalPrice=price,stars=[int(n)for n in r['Star'].split(',') if int(n)>0],extraXp=r['ExtraExp']))
interiors=[dict(id=r['id'],name=r['name'].replace('普拉内饰','田园餐厅 · ').replace('拉姆内饰','拉姆餐厅 · '),level=r['condition'],cost=int(r['price']),stoves=r['stoves'],counters=r['servingCounters'],tables=r['tables']) for r in data['interiors']]
(root/'src/restaurant-data.json').write_text(json.dumps(dict(recipes=recipes,interiors=interiors,levels=data['growth']['level'],staffLimits=data['growth']['EmpCountByLevel'],honors=data['growth']['honorName']),ensure_ascii=False,indent=2)+'\n')
