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
docClient.scan({
    TableName: "images",
    // KeyConditionExpression:"",
    Limit: 1,
}).promise().then(console.log)
