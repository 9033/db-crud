const db=require('./models');
const XLSX=require('xlsx')
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

const keysPackages = async () =>{
    // find pk columns
    const t = await dynamodb.describeTable({
        TableName: "packages",
    }).promise()
    return t.Table.KeySchema.filter(k=>['HASH','RANGE'].includes(k.KeyType)).map(k=>k.AttributeName)
}
const getPackages = async () =>{
    let r = await docClient.scan({
        TableName : 'packages',
    }).promise()
    
    let columns = ['title','start_time','end_time','comment'];
    let rows = r.Items
    // console.log(rows);
    
    return {columns, ren:rows}
}

const getRead = (req, res) => (func, callback) => { // preset of then, catch, finally
    return func(req).then(callback)
    .catch(e=>{console.error(e);res.writeHead(404,'NOT FOUND')}).finally(()=>{res.end()})
}

const crypto = require('crypto');
const checkTrueuser = async (id_token)=>{ // 사용자를 확인.
    if(typeof id_token !== typeof 'String' || id_token === 'undefined'){
        // console.error('token not received')
        // throw 'token not received';
        return false
    }
    const access_user = await googleAuth.verify(id_token)
    const hash = crypto.createHash('sha256'); // ERR_CRYPTO_HASH_FINALIZED 에러로 인해서 여기로 옮김.
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
// 입력값 전처리.
const preProcessSet = {}
preProcessSet['start_time'] = v => (new Date(v)).toISOString();
preProcessSet['end_time'] = v => (new Date(v)).toISOString();
const preProcessCol = (colName, val = null) => preProcessSet[colName]?preProcessSet[colName](val):val
const postPackage = async (reqBody)=>{
    // console.log(reqBody);    
    if( Array.isArray(reqBody) ){ //excel 업로드에 사용.
    }
    else{
        await dynamodb.putItem({
            Item:{
                title:{
                    S:preProcessCol('title',reqBody.title),
                },
                create_time:{
                    S:(new Date()).toISOString(),
                },
                start_time:{
                    S:preProcessCol('start_time',reqBody.start_time),
                },
                end_time:{
                    S:preProcessCol('end_time',reqBody.end_time),
                },
                comment:{
                    S:preProcessCol('comment',reqBody.comment),
                }
            },
            TableName: "packages"
        }).promise()
    }
}
const tableKeys = async (row)=>{ // param에 들어갈 Key를 생성.
    // filtering attributes
    const Key = {}
    const keys = await keysPackages()
    for(let k of keys){
        Key[k] = {}
        Key[k]['S'] = row[k]
    }
    return Key;
}
const deletePackage = async (row)=>{
    const Key = await tableKeys(row)
    await dynamodb.deleteItem({
        Key,
        TableName: "packages"
    }).promise()
}
const patchPackage = async (b)=>{
    console.log(b);
    const Key = await tableKeys(b.row)
    await dynamodb.updateItem({
        ExpressionAttributeNames: {
            "#colName": b.field,
        },
        ExpressionAttributeValues: {
            ":val": {
                S: preProcessCol(b.field,b.toval),
            },
        },
        Key,
        TableName: "packages",
        UpdateExpression: "SET #colName = :val",
    }).promise()
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
            patchPackage(b)
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
            const b=JSON.parse(body);
            // console.log('DELETE 본문(body):',b);
            deletePackage(b)
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
