const db=require('./models');
const XLSX=require('xlsx')

const Sequelize = require('sequelize');


// const r=async (init=false)=>{//db초기화
//     if(init){/* db의 데이터를 초기화 */
//         let ret=await db.package.sync({force:true});
//     }
//     else{/* db의 데이터를 그대로 사용. */        
//         await db.package.sync();
//     }
// };
// r();

//https://developers.google.com/identity/sign-in/web/backend-auth
const CLIENT_ID = '504818718989-cpm7gtj8bjncqbjl3gp65tpdhj4uhman.apps.googleusercontent.com';
const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(CLIENT_ID);
async function verify(token) {
  const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
      // Or, if multiple clients access the backend:
      //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
  });
  const payload = ticket.getPayload();
  const userid = payload['sub'];
  // If request specified a G Suite domain:
  //const domain = payload['hd'];
  return userid;
}
// verify().catch(console.error);


const pug=require('pug');
const http=require('http');
const fs=require('fs');

const getAllData = (table) => async () =>{
    let columns=[];
    const descTable=await table.describe();
    for(i in descTable){
        if(i == 'createdAt' || i == 'updatedAt' || i == 'deletedAt')continue
        columns.push(i);
    }
    // console.log(columns);          

    const o={
        attributes:[...columns,[Sequelize.literal('case (end_time <= datetime("now")) when 1 then ("end") else case (datetime("now") BETWEEN start_time AND end_time) when 1 then "now" else "not yet" end end'),'between']],
        order:[Sequelize.literal('datetime("now") BETWEEN start_time AND end_time desc'),'end_time'],
    };    
    columns.push('between')
    const datas=await table.findAll(o);
    let rows=[];
    for(i in datas){
        rows.push( datas[i].get() );
    }
    return {columns, rows}
}

const getUsers = async (req)=>{
    // const r = await checkTrueuser(req.headers.id_token); 
    // if(!r)return {columns:[],ren:[]};
    const {columns, rows} = await getAllData(db.packages)()
    return {columns, ren:rows}
}

const getRead = (req, res) => (func, callback) => {
    return func(req).then(callback)
    .catch(e=>{console.error(e);res.writeHead(404,'NOT FOUND')}).finally(()=>{res.end()})
}

const checkTrueuser = async (id_token)=>{
    if(typeof id_token !== typeof 'String' || id_token === 'undefined'){
        // console.error('token not received')
        // throw 'token not received';
        return false
    }
    const access_user = await verify(id_token)
    const r = await db.trueuser.findOne({
        where:{
            id_str:access_user,
        }
    })
    // console.log(access_user,r);
    // if(!r)throw 'user error';
    return !!r
}
const postPackage = async (id_token, reqBody)=>{
    // const r = await checkTrueuser(id_token);
    // if(!r)throw 'user error';
    // console.log(r);
    const removeCols=['id','createdAt','updatedAt','deletedAt'];//삭제할 필드
    if( Array.isArray(reqBody) ){ //excel 업로드에 사용.
        for(let idx = 0;idx<b.length;idx++){
            removeCols.forEach(col=>{
                delete reqBody[idx][col];
            });
        }
        // console.log(b);
        await db.packages.bulkCreate(reqBody)
    }
    else{
        removeCols.forEach(col=>{
            delete reqBody[col];
        });
        // console.log(b);
        await db.packages.create(reqBody)
    }
}
const deletePackage = async (id_token, packages_id)=>{
    // const r = await checkTrueuser(id_token);
    // if(!r)throw 'user error';
    // console.log(r);
    await db.packages.destroy({where:{id:packages_id}})
}
const patchPackage = async (id_token, b)=>{
    // const r = await checkTrueuser(id_token);
    // if(!r)throw 'user error';
    // console.log(r);
    const o={};
    o[b.field]=b.toval;//한번에 한가지 컬럼만 수정이 가능.
    if(['id','createdAt','updatedAt','deletedAt'].every(v=>v!=b.field)){//수정하려는 필드가 특정 필드가 아닐때
        await db.packages.update(o,  {where:{id:b.id}})
    }
}
/*
db를 수정하거나 삭제나 추가한후 새로고침 한다. 그외에 방법으로 응답으로 json을 받아서 다시 front에서 그려주는 방법이 있다.
*/
function serverFn(req,res){
    console.log('SERVER : res');
    if(req.method=='GET'){//cRud or serve static
        if(req.url=='/'){
            getRead(req, res)(getUsers, ({columns, ren})=>{
                    // console.log('SERVER : render',ren);
                    res.writeHead(200, {'Content-Type':  'text/html' }); 
                    res.write(pug.renderFile('query.pug',{columns,r:ren}));
                }
            )
        }
        else if(req.url=='/json'){// json파일 출력.
            getRead(req, res)(getUsers, ({columns, ren})=>{
                    // console.log('SERVER : render',ren);
                    res.writeHead(200, {'Content-Type':  'application/json' });                 
                    res.write( JSON.stringify(ren) );
                }
            )
        }
        else if(/^\/[^/\\:*?"<>|]+\.ods$/.test(req.url)){// ods파일 출력. // 윈도우 기준.
            getRead(req, res)(getUsers, ({columns, ren})=>{
                    // console.log('SERVER : render',ren);
                    res.writeHead(200, {'Content-Type':  'application/vnd.oasis.opendocument.spreadsheet' });                 

                    let wb = XLSX.utils.book_new();
                    wb.SheetNames.push("package");
                    wb.Sheets['package'] = XLSX.utils.json_to_sheet(ren, {header:columns})
                    let ods = XLSX.write(wb, { bookType: 'ods', type: 'binary' });
                    // console.log(columns);
                    res.write( ods ,'binary');
                }
            )
        }
        else {//serve file
            fs.readFile(`./public${req.url}`, (e,d)=>{
                if(e){
                    res.writeHead(404,'NOT FOUND');
                    return res.end('NOT FOUND');
                }
                res.end(d);
            });
        }
    }
    else if(req.method=='PATCH'){//crUd
        //수정
        // user.update        
        let body='';
        req.on('data',(d)=>{
            body+=d;
        });
        return req.on('end',()=>{
            const b=JSON.parse(body);
            // console.log('PATCH 본문(body):',b);
            patchPackage(req.headers.id_token, b)
            .then(r=>{
                console.log('update ok');
                res.end('PATCH ok!');
            })
            .catch(e=>{
                console.error(e);
                res.writeHead(404,'NOT FOUND');
                res.end('PATCH not ok!');
            });
        });
    }
    else if(req.method=='DELETE'){//cruD
        let body='';
        req.on('data',(d)=>{
            body+=d;
        });
        return req.on('end',()=>{
            const b=parseInt(JSON.parse(body),10);
            // console.log('DELETE 본문(body):',b);
            deletePackage(req.headers.id_token, b)
            .then(r=>{
                console.log('destroy ok');
                res.end('DELETE ok!');
            })
            .catch(e=>{
                console.error(e);
                res.writeHead(404,'NOT FOUND');
                res.end('DELETE not ok!');
            });
        });
    }
    else if(req.method=='POST'){//Crud
        let body='';
        req.on('data',(d)=>{
            body+=d;
        });
        return req.on('end',()=>{
            const b=JSON.parse(body);
            // console.log('POST 본문(body):',b);
            
            postPackage(req.headers.id_token, b)
            .then(()=>{
                console.log('POST ok');
                res.end('POST ok!');
            })
            .catch(e=>{
                console.error(e);
                res.writeHead(404,'NOT FOUND');
                res.end('POST not ok!');
            })
        });
    }
}
const server=http.createServer(function (req, res) {
    if(req.method!='GET'){
        checkTrueuser(req.headers.id_token)
        .then(r=>{
            if(!r){
                res.writeHead(404,'NOT FOUND');
                res.end('NOT FOUND');
            } else {
                serverFn(req, res)
            }
        })
        .catch(e=>{
            res.writeHead(404,'NOT FOUND');
            res.end('NOT FOUND');
        })
    } else {
        serverFn(req, res)
    }
});
server.listen(80, ()=>{
     console.log('SERVER : listen');
});

db.sequelize.query('select id_str from trueuser;', {type : db.sequelize.QueryTypes.SELECT })
.then(v=>{
    console.log(v)
})
// db.trueuser.findOrCreate({
//     where:{
//         id_str:'',
//     },
//     defaults:{
//         id_str:'',
//     }
// })
