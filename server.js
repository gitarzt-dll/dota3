// Простой сервер: раздаёт index.html и пересылает сообщения между хостом и игроками комнаты.
const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const server=http.createServer((req,res)=>{
  if(req.url==='/health'){res.end('ok');return}
  fs.readFile(path.join(__dirname,'index.html'),(e,d)=>{
    if(e){res.writeHead(500);return res.end('index.html not found')}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(d)});
});
const wss=new WebSocketServer({server,maxPayload:256*1024});
const rooms=new Map();let uid=1;
const gen=()=>Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random()*32|0]).join('');
const out=(ws,o)=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))};
wss.on('connection',ws=>{
  ws.id='c'+uid++;
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m.t==='create'){
      let code;do{code=gen()}while(rooms.has(code));
      rooms.set(code,{host:ws,c:new Map()});ws.room=code;ws.isHost=true;out(ws,{t:'created',code});
    }else if(m.t==='join'){
      const r=rooms.get(String(m.code||'').toUpperCase());
      if(!r)return out(ws,{t:'nojoin'});
      if(r.c.size>=8)return out(ws,{t:'full'});
      r.c.set(ws.id,ws);ws.room=String(m.code).toUpperCase();
      out(ws,{t:'joined',id:ws.id});out(r.host,{t:'peer',id:ws.id});
    }else if(m.t==='to'&&ws.isHost){
      const r=rooms.get(ws.room),c=r&&r.c.get(m.id);out(c,m.m);
    }else if(m.t==='msg'&&!ws.isHost){
      const r=rooms.get(ws.room);if(r)out(r.host,{t:'from',id:ws.id,m:m.m});
    }
  });
  ws.on('close',()=>{
    const r=rooms.get(ws.room);if(!r)return;
    if(ws.isHost){for(const c of r.c.values())out(c,{t:'hostgone'});rooms.delete(ws.room)}
    else{r.c.delete(ws.id);out(r.host,{t:'peerleft',id:ws.id})}
  });
});
server.listen(process.env.PORT||3000,()=>console.log('Throne Wars server on',process.env.PORT||3000));
