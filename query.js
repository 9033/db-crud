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

const googleAuth = require('./js/google-auth')

/*
{columns, ren:rows}
couumns: query.pug에서 출력할 컬럼을 지정.
*/

const pug=require('pug');
const http=require('http');
const fs=require('fs');

const AWS = require('aws-sdk');
AWS.config.update({
  region: "ap-northeast-2",
});
const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

const getPackages = async () =>{
    let r = await docClient.scan({
        TableName : 'packages',
    }).promise()
    
    let columns = ['title','start_time','end_time','comment'];
    let rows = r.Items
    console.log(rows);
    
    return {columns, ren:rows}
}

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

const getRead = (req, res) => (func, callback) => { // preset of then, catch, finally
    return func(req).then(callback)
    .catch(e=>{console.error(e);res.writeHead(404,'NOT FOUND')}).finally(()=>{res.end()})
}

const crypto = require('crypto');
const hash = crypto.createHash('sha256');
const checkTrueuser = async (id_token)=>{ // 사용자를 확인.
    if(typeof id_token !== typeof 'String' || id_token === 'undefined'){
        // console.error('token not received')
        // throw 'token not received';
        return false
    }
    const access_user = await googleAuth.verify(id_token)
    hash.update(access_user);
    const hashed_access_user = hash.digest('base64'); 
    const r = await dynamodb.getItem({
        TableName:"trueuser",
        Key:{
            "userhash":{
                S:hashed_access_user,
            }
        },
    }).promise();
    return !!r.Item
}
const postPackage = async (reqBody)=>{
    // console.log(reqBody);    
    const nowDate = new Date();
    if( Array.isArray(reqBody) ){ //excel 업로드에 사용.
    }
    else{
        await dynamodb.putItem({
            Item:{
                title:{
                    S:reqBody.title,
                },
                create_time:{
                    S:nowDate.toISOString(),
                },
                start_time:{
                    S:(new Date(reqBody.start_time)).toISOString(),
                },
                end_time:{
                    S:(new Date(reqBody.end_time)).toISOString(),
                },
                comment:{
                    S:reqBody.comment,
                }
            },
            TableName: "packages"
        }).promise()
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
            getRead(req, res)(getPackages, ({columns, ren})=>{
                    // console.log('SERVER : render',ren);
                    res.writeHead(200, {'Content-Type':  'text/html' }); 
                    res.write(pug.renderFile('query.pug',{columns,r:ren}));
                }
            )
        }
        else if(req.url=='/json'){// json파일 출력.
            getRead(req, res)(getPackages, ({columns, ren})=>{
                    // console.log('SERVER : render',ren);
                    res.writeHead(200, {'Content-Type':  'application/json' });                 
                    res.write( JSON.stringify(ren) );
                }
            )
        }
        else if(/^\/[^/\\:*?"<>|]+\.ods$/.test(req.url)){// ods파일 출력. // 윈도우 기준.
            getRead(req, res)(getPackages, ({columns, ren})=>{
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
            
            postPackage(b)
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
