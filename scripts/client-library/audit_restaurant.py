#!/usr/bin/env python3
"""Inventory a possible restaurant port from the pinned original client."""
import csv,hashlib,json,re,sqlite3,zlib
from pathlib import Path
from amf3 import AMF3Reader
from library import REPO,VAULT,save_json

CONFIG=VAULT/'extracted/root/dll/ClientConfigDLL.swf/scripts/com/global/staticData/database'
CORE=VAULT/'extracted/root/dll/ClientAppDLL.swf/scripts/com/module/restaurant'
OUT=REPO/'research/references/restaurant'
CACHE=VAULT/'research/restaurant-port'

def objects(name):
    text=(CONFIG/f'Info{name}Obj.as').read_text()
    return {int(key):json.loads(value) for key,value in re.findall(name+r'Obj\[(\d+)\]\s*=\s*(\{.*?\});',text,re.S)}

def main():
    binary=next((VAULT/'extracted/root/dll/ClientConfigDLL.swf/binaryData').glob('*XMLInfo_itemXmlData*.bin'))
    data=zlib.decompress(binary.read_bytes());reader=AMF3Reader(data);items=reader.read()
    assert reader.offset==len(data) and items['0']['name']=='摩尔豆'
    all_foods={int(key):value for key,value in items.items() if key.isdigit() and 1340001<=int(key)<=1349999}
    foods={key:value for key,value in all_foods.items() if value.get('NeedTimer',0)>0}
    descriptions=objects('RestaurantMenu');assert set(foods)==set(descriptions)
    styles={int(key):value for key,value in items.items() if key.isdigit() and 1330001<=int(key)<=1339999 and value.get('Stove',0)>0}
    with sqlite3.connect(VAULT/'catalog.sqlite') as connection:paths={row[0] for row in connection.execute('SELECT path FROM assets')}
    probes={}
    for filename in ['official-probes.json','official-probe-followup.json']:
        file=CACHE/filename
        if file.exists():
            for result in json.loads(file.read_text()):probes[result['path']]=result
    def asset(relative):
        probe=probes.get(relative,{})
        return {'path':relative,'inPinnedArchive':'root/'+relative in paths,'officialProbe':probe or None,'cachedOfficialCopy':bool(probe.get('validSwf') and (CACHE/'official'/relative).is_file())}
    core=[];literal=set()
    for file in sorted(CORE.glob('*.as')):
        text=file.read_text();literal.update(re.findall(r'"((?:resource|module)/[^"+]*\.swf)"',text))
        core.append({'path':str(file.relative_to(VAULT)),'lines':len(text.splitlines()),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'decompilerWarning':any(s in text for s in ['Error during decompilation','Decompilation error','Decompilation timeout'])})
    socket=VAULT/'extracted/root/dll/ClientSocketDLL.swf/scripts/com/logic/socket/oneBigStreetSocket/oneBigStreetSocket.as';text=socket.read_text();commands=[]
    for match in re.finditer(r'public static function (\w+)\((.*?)\).*?(?=public static function|\Z)',text,re.S):
        command=re.search(r'MsgHead.Command\s*=\s*(\d+)',match.group())
        if command:commands.append({'method':match[1],'command':int(command[1]),'line':text[:match.start()].count('\n')+1})
    ui=(CONFIG/'InfoRestaurantUIObj.as').read_text()
    arrays={name:json.loads('['+re.search(r'RestaurantUIObj\.'+name+r'\s*=\s*new Array\((.*?)\);',ui,re.S)[1]+']') for name in ['level','EmpWorkTimer','EmpCountByLevel','favorlimitByLevel','honorName']}
    recipe_rows=[]
    for key,value in sorted(foods.items()):
        row={k:value.get(k) for k in ['ID','Name','NeedTimer','Timeout','Count','Price','SellPrice','Condition','Food','Star','ExtraCount','ExtraExp','VipOnly']}
        row['model']=asset(f'resource/restaurant/swf/{key}.swf');row['menuIcon']=asset(f'resource/restaurant/meunicon/{key}.swf');recipe_rows.append(row)
    sources=[]
    for relative in ['root/dll/ClientAppDLL.swf','root/dll/ClientSocketDLL.swf','root/dll/ClientConfigDLL.swf','root/dll/ClientCommonDLL.swf','root/module/restaurant/restaurant.swf']:
        file=VAULT/'raw'/relative;sources.append({'path':relative,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size})
    ingredient_ids=sorted({int(key) for value in foods.values() for key in str(value.get('Food','0')).split(',') if key and key!='0'})
    assert all(str(key) in items for key in ingredient_ids)
    result={'date':'2026-11-05','revision':json.loads((VAULT/'source-status.json').read_text())['revision'],'scope':'Research only: original web client snapshot, not the mobile remake or all historical versions. No official game server connection was made.','sources':sources,'amf3':{'binaryPath':str(binary.relative_to(VAULT)),'binarySha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'decodedItemCount':len(items),'bytesConsumed':reader.offset,'bytesExpected':len(data)},'coreClasses':core,'socketCommands':commands,'serverPushCommands':[1026,1029,1047],'recipes':recipe_rows,'ingredientItems':[{'id':key,'name':items[str(key)]['name']} for key in ingredient_ids],'menuNameDifferences':[{'id':key,'itemName':value['name'],'menuName':descriptions[key]['name']} for key,value in foods.items() if value['name']!=descriptions[key]['name']],'nonCookingFoodEntries':[{'id':key,'name':value['name'],'NeedTimer':value.get('NeedTimer')} for key,value in sorted(all_foods.items()) if key not in foods],'growth':arrays,'maxLevel':int(re.search(r'maxLevel\s*=\s*(\d+)',ui)[1]),'systemGuestCount':len(objects('RestaurantGuest')),'eventCount':len(objects('RestaurantEvent')),'interiors':[{'id':key,'name':value['name'],'stoves':value['Stove'],'servingCounters':value['FoodTable'],'tables':value['Table'],'price':value['Price'],'condition':value['Condition'],'asset':asset(f'resource/oneBigStree/swf/{key}.swf')} for key,value in sorted(styles.items())],'literalModuleReferences':[asset(relative) for relative in sorted(literal)],'officialProbes':list(probes.values()),'restaurantSounds':[{'path':str(file.relative_to(VAULT)),'bytes':file.stat().st_size} for file in sorted((VAULT/'extracted/root/module/restaurant/restaurant.swf/sounds').glob('*.mp3'))]}
    result['coverage']={'regularRecipes':len(foods),'menuDescriptions':len(descriptions),'localFoodModels':sum(row['model']['inPinnedArchive'] for row in recipe_rows),'localMenuIcons':sum(row['menuIcon']['inPinnedArchive'] for row in recipe_rows),'interiors':len(styles),'localInteriors':sum(row['asset']['inPinnedArchive'] for row in result['interiors']),'staticSwfReferences':len(literal),'localStaticSwfReferences':sum(row['inPinnedArchive'] for row in result['literalModuleReferences'])}
    save_json(OUT/'port-feasibility.json',result)
    with (OUT/'recipe-coverage.csv').open('w',newline='',encoding='utf-8-sig') as output:
        writer=csv.writer(output,lineterminator='\n');writer.writerow(['ID','菜名','烹饪秒数','烧糊前秒数','基础份数','原成本字段','原售价字段','解锁条件字段','本地原存档模型','本地原存档菜谱图标'])
        for row in recipe_rows:writer.writerow([row['ID'],row['Name'],row['NeedTimer'],row['Timeout'],row['Count'],row['Price'],row['SellPrice'],row['Condition'],row['model']['inPinnedArchive'],row['menuIcon']['inPinnedArchive']])
    print(json.dumps({'coverage':result['coverage'],'coreClasses':len(core),'coreLines':sum(row['lines'] for row in core),'socketCommands':len(commands),'itemRecords':len(items),'maxLevel':result['maxLevel'],'systemGuests':result['systemGuestCount'],'events':result['eventCount'],'honors':len(arrays['honorName']),'officialProbeSwfs':sum(row.get('validSwf',False) for row in probes.values()),'officialProbeUnresolved':[row['path'] for row in probes.values() if not row.get('validSwf')]},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
