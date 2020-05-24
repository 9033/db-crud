const db={};

const Sequelize = require('sequelize');
db.sequelize=new Sequelize('database', 'username', 'password', {
    dialect: 'sqlite',
    storage: 'db.sqlite',
    logging: false,
});

//자주 쓰이는 컬럼 양식.
const columns = {}
columns.id = {
    type:Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,        
}
//테이블 설정.
const table = {}
table.packages ={ 
    id:columns.id,
    name:{
        type:Sequelize.STRING,
        allowNull:false,
    },
    start_time:{
        type:Sequelize.DATE,        
        allowNull:false,
    },
    end_time:{
        type:Sequelize.DATE,        
        allowNull:false,
    },
    comment:{
        type:Sequelize.STRING,        
        allowNull:true,
        defaultValue: null,
    },
};
table.trueuser ={// 로그인 가능한 사람들. (구글 계정)
    id:columns.id,
    id_str:{//외부 auth 에서 사용하는 식별자
        type:Sequelize.STRING,
        allowNull:false,
    },
};
for(let table_name of Object.keys(table)){
    db[table_name] = db.sequelize.define(table_name,table[table_name],{
        timestamps:true,
        pananoid:true,//set using deleteAt
        freezeTableName: true,
    });
}

//relationship
const relationship={}
relationship["1:N"]=(db1,sourceKey,dbN,foreignKey)=>{
    db1.hasMany(dbN,{foreignKey,sourceKey});
    dbN.belongsTo(db1,{foreignKey,targetKey:sourceKey});    
}
relationship["1:1"]=(db1,sourceKey,db2,foreignKey)=>{
    db1.hasOne(db2,{foreignKey,sourceKey});
    db2.belongsTo(db1,{foreignKey,targetKey:sourceKey});    
}
relationship["N:M"]=(dbN,dbM,through)=>{
    dbN.belongsToMany(dbM,{through});
    dbM.belongsToMany(dbN,{through});    
}

// relationship["1:N"](db.user,'id',db.car,'user_id');

module.exports = db;
