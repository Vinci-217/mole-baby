const {expect}=require('@playwright/test');
const {enterHome,toDesktop,openActions,selectPocket}=require('./smoke-helpers.cjs');

/** Runs against the packaged renderer on Windows and both Mac architectures. */
async function verifyRegisteredWardrobe(page){
  const original=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k==='ramu-house-save-v1'||k==='ramu-house-preferences-v2'||k.includes('companion'))));
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  try{
    await page.evaluate(()=>{
      const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));
      Object.assign(p,{coins:500,growth:180,sleeping:false,color:'blue',wardrobe:['party-cap','gold-feather','wizard-cap'],wearing:'wizard-cap',lastTick:Date.now(),stats:{hunger:40,thirst:90,cleanliness:90,happiness:90,health:100,energy:90}});delete p.evolution;p.inventory.biscuit=2;
      localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:false,lively:false}));
    });
    await page.reload();const ram=page.getByTestId('desktop-character').locator('.ram-sprite');
    await expect(ram.locator('.ram-wear')).toHaveAttribute('data-registration','original-source');
    await enterHome(page);await page.getByRole('button',{name:'拉姆小衣橱',exact:true}).click();const wardrobe=page.locator('.wardrobe');
    await expect(wardrobe.locator('.wardrobe-grid>button')).toHaveCount(9);
    await wardrobe.getByRole('button',{name:'试戴粉兔帽',exact:true}).click();
    for(const name of ['开心','不高兴','吃东西','玩球']){
      await wardrobe.getByRole('button',{name:`预览${name}动作`,exact:true}).click();
      await expect(wardrobe.locator('.ram-wear')).toHaveAttribute('data-registration','original-source');
    }
    expect((await save()).coins).toBe(500);expect((await save()).wearing).toBe('wizard-cap');expect((await save()).inventory.biscuit).toBe(2);
    await wardrobe.getByRole('button',{name:'衣橱下一页',exact:true}).click();
    await wardrobe.getByRole('button',{name:'试戴皇冠猫耳',exact:true}).click();
    await wardrobe.getByRole('button',{name:'买下 · 50 摩尔豆',exact:true}).evaluate(b=>{b.click();b.click()});
    expect((await save()).coins).toBe(450);expect((await save()).wardrobe).toEqual(['party-cap','gold-feather','wizard-cap','warm-scarf']);
    await wardrobe.getByRole('button',{name:'给拉姆戴上',exact:true}).click();
    await toDesktop(page);await page.reload();await expect(ram.locator('.ram-wear')).toHaveAttribute('data-outfit','warm-scarf');
    await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'查看状态',exact:true}).click();const book=page.locator('.classic-pet-book');
    await book.getByRole('tab',{name:'玩耍',exact:true}).click();await book.getByRole('button',{name:'一起玩球',exact:true}).click();
    await expect(ram).toHaveAttribute('data-action','play');const body=ram.locator('.ram-football-frame');await expect(body).toHaveAttribute('data-loaded','true');
    await body.evaluate(n=>{window.wardrobeFootballCanvas=n;window.wardrobeFootballFrame=Number(n.dataset.sourceFrame)});
    await book.getByRole('tab',{name:'装扮',exact:true}).click();await book.locator('[data-outfit-id="wizard-cap"]').click();await book.getByRole('button',{name:'戴上看看',exact:true}).click();
    await expect(ram).toHaveAttribute('data-action','play');expect(await body.evaluate(n=>n===window.wardrobeFootballCanvas)).toBe(true);
    await expect(ram.locator('.ram-wear')).toHaveAttribute('data-outfit','wizard-cap');await expect(ram.locator('.ram-wear')).toHaveAttribute('data-registration','original-source');
    await expect.poll(()=>body.evaluate(n=>Number(n.dataset.sourceFrame)>window.wardrobeFootballFrame)).toBe(true);
    await expect(ram).toHaveAttribute('data-action','idle',{timeout:20000});
    await book.getByRole('tab',{name:'用品',exact:true}).click();await(await selectPocket(page,'biscuit','熊熊饼干')).click();
    await expect(ram).toHaveAttribute('data-action','eat-bear-biscuit');await expect(ram.locator('.ram-wear')).toHaveAttribute('data-registration','original-source');
    expect((await save()).inventory.biscuit).toBe(1);expect((await save()).wardrobe).toHaveLength(4);expect((await save()).coins).toBe(450);
    await expect(ram).toHaveAttribute('data-action','idle',{timeout:10000});
    await book.getByRole('button',{name:'关闭小窗',exact:true}).click();
    expect((await page.getByTestId('desktop-character').boundingBox()).width).toBe(100);
    console.log('PASS: original animated wardrobe, nine outfits, free previews, persistent purchases and outfit changes preserve football clock and care inventory');
  } finally {
    const close=page.locator('.classic-pet-book').getByRole('button',{name:'关闭小窗',exact:true});if(await close.isVisible())await close.click();
    await page.evaluate(values=>{for(const k of Object.keys(localStorage))if(k==='ramu-house-save-v1'||k==='ramu-house-preferences-v2'||k.includes('companion'))localStorage.removeItem(k);for(const[k,v]of Object.entries(values))localStorage.setItem(k,v)},original);
    await page.reload();await page.getByTestId('desktop-character').waitFor();
  }
}
module.exports={verifyRegisteredWardrobe};
