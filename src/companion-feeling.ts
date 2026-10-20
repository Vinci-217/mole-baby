/** Interpret what was actually said, including common negations. No diagnosis. */
export function companionFeeling(text: string): 'low' | 'bright' | null {
  const stated = text.replace(/(?:一点也不|并不|不是|不再|没那么|不怎么|没有|没|不)(?:觉得|感到)?(?:累|难过|伤心|失落|焦虑|紧张|不开心|不高兴)|压力(?:不大|很小|没有)|没有压力/g, '')
  if (/(?:不|没)(?:太|怎么)?(?:开心|高兴)|(?:开心|高兴)不起来|难过|伤心|失落|焦虑|压力(?:好大|很大|有点大|大)|有(?:点|些)?压力|累/.test(stated)) return 'low'
  const positive = stated.replace(/(?:还没|没能|没有|没|未|不算|谈不上|不)(?:有)?(?:完成|成功|考过|拿到|开心|高兴|顺利)/g, '')
  return /开心|高兴|顺利|成功|完成|考过|拿到/.test(positive) ? 'bright' : null
}
