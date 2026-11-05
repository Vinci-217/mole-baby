"""Decode data-only AMF3 configuration; never execute ActionScript."""
import struct

class AMF3Reader:
    def __init__(self,data):
        self.data=data;self.offset=0;self.strings=[];self.objects=[];self.traits=[]
    def take(self,length):
        if self.offset+length>len(self.data):raise ValueError('Truncated AMF3')
        value=self.data[self.offset:self.offset+length];self.offset+=length;return value
    def u29(self):
        value=0
        for _ in range(3):
            byte=self.take(1)[0]
            if byte<128:return (value<<7)|byte
            value=(value<<7)|(byte&127)
        return (value<<8)|self.take(1)[0]
    def string(self):
        header=self.u29()
        if not header&1:return self.strings[header>>1]
        length=header>>1
        if not length:return ''
        value=self.take(length).decode('utf-8');self.strings.append(value);return value
    def read(self):
        tag=self.take(1)[0]
        if tag in (0,1):return None
        if tag==2:return False
        if tag==3:return True
        if tag==4:
            value=self.u29();return value-(1<<29) if value&(1<<28) else value
        if tag==5:return struct.unpack('>d',self.take(8))[0]
        if tag==6:return self.string()
        if tag in (7,8,9,10,11,12):
            header=self.u29()
            if not header&1:return self.objects[header>>1]
            if tag in (7,11,12):
                value=self.take(header>>1)
                if tag!=12:value=value.decode('utf-8')
                self.objects.append(value);return value
            if tag==8:
                value=struct.unpack('>d',self.take(8))[0];self.objects.append(value);return value
            if tag==9:
                name=self.string();value={} if name else [];self.objects.append(value)
                while name:
                    value[name]=self.read();name=self.string()
                for index in range(header>>1):
                    item=self.read()
                    if isinstance(value,list):value.append(item)
                    else:value[str(index)]=item
                return value
            if not header&2:trait=self.traits[header>>2]
            else:
                external=bool(header&4);dynamic=bool(header&8);class_name=self.string()
                names=[self.string() for _ in range(header>>4)]
                trait=(external,dynamic,class_name,names);self.traits.append(trait)
            external,dynamic,class_name,names=trait
            if external:raise ValueError('Externalizable objects require explicit handling')
            value={};self.objects.append(value)
            for name in names:value[name]=self.read()
            if dynamic:
                while True:
                    name=self.string()
                    if not name:break
                    value[name]=self.read()
            return value
        raise ValueError(f'Unsupported AMF3 tag {tag} at {self.offset-1}')
