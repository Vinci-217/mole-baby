const input=document.getElementById('percent'),error=document.getElementById('error');
window.petSize.get().then(scale=>{input.value=Math.round(scale*100);input.select()}).catch(()=>{error.textContent='暂时无法读取大小，请重新打开。'});
document.getElementById('size-form').addEventListener('submit',async event=>{event.preventDefault();const percent=input.valueAsNumber;if(!Number.isInteger(percent)||percent<50||percent>300){error.textContent='请输入50到300之间的整数。';return}try{await window.petSize.save(percent)}catch(reason){error.textContent=reason.message||'暂时无法调整，请重试。'}});
