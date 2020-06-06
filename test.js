const db=require('./models');

const main=async (init=false)=>{//db초기화
    if(init){/* db의 데이터를 초기화 */
        let ret=await db.user.sync({force:true});
        // db에 초기값 지정.
        await db.user.create({
            name:"한조"
        });
        const r = await db.user.findOne({where:{name:"한조"}})
        const user_id=r.dataValues.id;


        ret=await db.car.sync({force:true});
        // db에 초기값 지정.

        await db.car.create({
            name:"마세라티",
            user_id:r.dataValues.id,
        })
        await db.car.create({
            name:"테슬라",
            user_id:r.dataValues.id,
        })


    }
    else{/* db의 데이터를 그대로 사용. */        
        await db.user.sync();
        await db.car.sync();
    }

    

    const users=await db.user.findAll();
    const cars=await db.car.findAll();

    console.log(users.map(e=>e.dataValues));
    console.log(cars.map(e=>e.dataValues));
    
    console.log(
        JSON.stringify(await db.car.findAll({
            // attributes:['name'],
            include:[{                
                model:db.user,
                // attributes:['name'],
            }]
        }).map(e=>e.dataValues))
    );
    console.log(
        JSON.stringify(await db.user.findAll({
            // attributes:['name'],
            include:[{                
                model:db.car,
                // attributes:['name'],
            }]
        }).map(e=>e.dataValues))
    );
    
};
// main();
const main2=async (init=false)=>{
    let r = await db.sequelize.query("select datetime('now'), datetime('now','localtime')"); 
    console.log(r)
    r = await db.sequelize.query("select date('now'), date('now','localtime')"); 
    console.log(r)
}

// main2()

/*
2020-05-26:
    dynamodb 코드 test.
    dynamodb 적용 계획.
        package table CRUD.
        trueuser table CRUD.
2020-05-31:
    datetime: start_date, end_date는 숫자. Date.parse()로 timestamp로 변환해서 넣는다.
        아니면 toISOString으로 변환해서 넣는다. <- 알아보기 쉬운게 좋을듯.
    dateonly: '2020-05-01'이런 식으로 문자열로 넣는다.
    string이든 number든 내부적으로 각 데이터 타입에 맞게 정렬이 되니 마찬가지.
    cf. iso time foramt.
        Date.parse("2010-12-21T17:42:34Z"): without timezone
        Date.parse("2010-12-21T17:42:34+09:00"): w tz
        ex) get timestamp of "2020-06-01 KRT" -> Date.parse("2020-06-01T00:00+09:00"): must have 'hh:mm'
    cf. 2
        https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes
*/
// cf. https://github.com/aws-samples/aws-nodejs-sample
const AWS = require('aws-sdk');
AWS.config.update({
  region: "ap-northeast-2",
});
const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

// dynamodb.getItem({
//     TableName:"images",
//     Key:{
//         "name":{
//             S:"images/05.jpg",
//         }
//     },
// }).promise().then(console.log)

// get list
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#scan-property
// docClient.scan({
//     TableName: "images",
//     // KeyConditionExpression:"",
//     // Limit: 1,
// }).promise().then(console.log)

// table의 목록.
// dynamodb.listTables().promise().then(console.log)

// table의 성질
// dynamodb.describeTable({
//     TableName: "packages",
// }).promise().then(r=>console.log(JSON.stringify(r, null, 2)))

// table 만들기
let params = {
    AttributeDefinitions: [
        {
            AttributeName: "title",
            AttributeType: "S",
        },
        {
            AttributeName: "create_time",
            AttributeType: "S",
        }
    ],
    KeySchema: [
        {
            AttributeName: "title",
            KeyType: "HASH",
        },
        {
            AttributeName: "create_time",
            KeyType: "RANGE",
        }
    ],
    BillingMode: 'PAY_PER_REQUEST',
    TableName: "packages"
};
// dynamodb.createTable(params).promise().then(r => console.log(JSON.stringify(r, null, 2)))
// dynamodb.updateTable(params).promise().then(r => console.log(JSON.stringify(r, null, 2)))
// dynamodb.deleteTable({
//     TableName: "packages"
// }).promise().then(r => console.log(JSON.stringify(r, null, 2)))
// dynamodb.describeTable({
//     TableName: "packages",
// }).promise().then(r=>console.log(JSON.stringify(r, null, 2)))
const nowDate = new Date();
// dynamodb.putItem({
//     Item:{
//         title:{
//             S:'three kingdoms p 2'
//         },
//         create_time:{
//             S:nowDate.toISOString(),
//         },
//         start_date:{
//             N:Date.parse("2020-06-01").toString(),
//         },
//         end_date:{
//             N:Date.parse("2020-09-01").toString(),
//         },
//         comment:{
//             S:'comment',
//         }
//     },
//     TableName: "packages"
// }).promise().then(r => console.log(JSON.stringify(r, null, 2)))
// .finally(()=>{
//     docClient.scan({
//         TableName : 'packages',        
//     }).promise().then(r => console.log(JSON.stringify(r, null, 2)))
// })

// 구간 검색.
/*
putItem일때는 숫자를 문자열로.
scan일때는 숫자는 숫자로.
*/
// docClient.scan({
//     TableName : 'packages',
//     FilterExpression : 'start_date BETWEEN :this_year AND :that_year',
//     ExpressionAttributeValues : {
//         ':this_year' : Date.parse('2020-05-02'),
//         ':that_year' : Date.parse('2020-07-01'),
//     },    
// }).promise().then(r => console.log(JSON.stringify(r, null, 2)))

// docClient.scan({
//     TableName : 'packages',
//     FilterExpression : ':to_date BETWEEN start_date AND end_date',
//     ExpressionAttributeValues : {
//         ':to_date' : Date.parse('2020-06-31'),
//     },    
// }).promise().then(r => console.log(JSON.stringify(r, nul 2)))

// hashing user id
// const crypto = require('crypto');
// const hash = crypto.createHash('sha256');
// hash.update('');
// console.log(hash.digest('base64'))

// check trueuser
dynamodb.getItem({
    TableName:"trueuser",
    Key:{
        "userhash":{
            S:"myhash",
        }
    },
}).promise().then(console.log)

// 구글 인증 파일을 분리.
// const googleAuth = require('./js/google-auth')
// const r = googleAuth.verify('a').then(console.log).catch(console.error)
// console.log(r)
