require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const jwt=require('jsonwebtoken');

//middlewares
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8iaibty.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection=client.db("beautyParlour").collection("users");
    const serviceCollection=client.db("beautyParlour").collection("services");
    const cartCollection=client.db("beautyParlour").collection("carts");
    const paymentCollection=client.db("beautyParlour").collection("payments");
    const messageCollection=client.db("beautyParlour").collection("messages");
    const commentCollection=client.db("beautyParlour").collection("comments");

  //jwt related api
    app.post('/jwt', async(req,res)=>{
      const user=req.body;
      const token=jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});
      res.send({token})
    })

  // middlewares
// server.js (inside run function) — replace verifyToken with this:
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized: Malformed token" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.error("JWT verify error:", err);
      // if token expired -> send 401
      return res.status(401).send({ message: "Unauthorized: Invalid or expired token" });
    }
    req.decoded = decoded;
    next();
  });
};


  // use verify admin after verifyToken
    const verifyAdmin=async(req,res,next)=>{
      const email=req.decoded.email;
      const query={email:email};
      const user=await userCollection.findOne(query);
      const isAdmin=user?.role==='admin';
      if(!isAdmin){
        return res.status(403).send({message: 'FOrbidden Access!'})
      }
      next();
    }

    //users api
    app.get('/users',verifyToken,verifyAdmin, async(req,res)=>{
      // console.log(req.headers);
        const result=await userCollection.find().toArray();
        res.send(result);
    })

  app.post("/users", async (req, res) => {
  const user = req.body; // { name: "...", email: "..." }
  const query = { email: user.email };

  const existingUser = await userCollection.findOne(query);
  if (existingUser) {
    return res.send({ message: "user already exists", insertedId: null });
  }

  // এখানে পুরো user object insert করতে হবে
  const result = await userCollection.insertOne(user);

  // Send back the inserted document info
  res.status(201).send(result);
});


    app.delete('/users/:id',verifyToken,verifyAdmin, async(req,res)=>{
      const id=req.params.id;
      const query={_id: new ObjectId(id)};
      const result =await userCollection.deleteOne(query);
      res.send(result);
    })

    app.patch('/users/admin/:id',verifyToken,verifyAdmin,async(req,res)=>{
      const id=req.params.id;
      const filter={_id:new ObjectId(id)};
      const updatedDoc={
        $set:{
          role:'admin'
        }
      }
      const result=await userCollection.updateOne(filter,updatedDoc);
      res.send(result)
    })


  app.get('/users/admin/:email',verifyToken, async(req,res)=>{
      const email=req.params.email;
      if(email !== req.decoded.email){
        return res.status(401).send({message: 'unAuthorized Access!'})
      }

      const query={email:email};
      const user=await userCollection.findOne(query);
      let admin=false;
      if(user){
        admin=user?.role==='admin'
      }
      res.send({admin})
  })

    // services api
    app.get('/services', async(req,res)=>{
      // console.log(req.headers);
        const result=await serviceCollection.find().toArray();
        res.send(result);
    })

            app.get('/services/:id', async(req,res)=>{
        const id=req.params.id;
        const query={_id:new ObjectId(id)}
        const result=await serviceCollection.findOne(query);
        res.send(result);
    })

    app.post('/services',verifyToken,verifyAdmin, async(req,res)=>{
        const service=req.body;
        const result=await serviceCollection.insertOne(service);
        res.send(result);
    })


        app.patch('/services/:id', async(req,res)=>{
      const item=req.body;
      const id=req.params.id;
      const filter={_id:new ObjectId(id)};
      const updatedDoc={
        $set:{
          name:item.name,
          category:item.category,
          price:item.price,
          description:item.description,
          image:item.image,
        }
      }

      const result=await serviceCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete('/services/:id',verifyToken,verifyAdmin, async(req,res)=>{
      const id=req.params.id;
      const query={_id: new ObjectId(id)};
      const result =await serviceCollection.deleteOne(query);
      res.send(result);
    })

    // comments api
   // comments api section
app.post('/comments', async (req, res) => {
  const comments = req.body;

  // ✅ নতুন অংশ: reply array রাখবো
  const newComment = {
    ...comments,
    replies: []  
  };

  const result = await commentCollection.insertOne(newComment);
  res.send(result);
});

app.patch("/comments/:id/replies", async (req, res) => {
  const id = req.params.id;
  const reply = req.body; // { userEmail, reply, createdAt }

  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $push: {
      replies: {
        _id: new ObjectId(),
        userEmail: reply.userEmail,
        reply: reply.reply,
        createdAt: new Date(reply.createdAt) || new Date()
      }
    }
  };

  const result = await commentCollection.updateOne(filter, updateDoc);
  res.send(result);
});

    app.get('/comments', async(req,res)=>{
      // console.log(req.headers);
        const result=await commentCollection.find().toArray();
        res.send(result);
    })

// নতুন কমেন্ট (মূল বা reply দুটোই হবে এখানে)
app.post('/comments', async (req, res) => {
  const { serviceId, userEmail, comment, createdAt, parentId = null } = req.body;

  const newComment = {
    serviceId,
    userEmail,
    comment,
    createdAt: new Date(createdAt) || new Date(),
    parentId // যদি reply হয় তাহলে parentId থাকবে
  };

  const result = await commentCollection.insertOne(newComment);
  res.send(result);
});

// সব কমেন্ট (মূল + reply) নিয়ে আসবো
app.get('/comments/:id', async (req, res) => {
  const id = req.params.id;
  const query = { serviceId: id };
  const result = await commentCollection.find(query).toArray();
  res.send(result);
});


    // cart api
    app.get('/carts', async(req,res)=>{
        const email=req.query.email;
        const query={email:email}
        const result=await cartCollection.find(query).toArray();
        res.send(result)
    })
   app.post('/carts', async(req,res)=>{
      const cartItem=req.body;
      const result=await cartCollection.insertOne(cartItem);
      res.send(result)
  })

   app.delete('/carts/:id', async(req,res)=>{
      const id=req.params.id;
      const query={_id: new ObjectId(id)};
      const result =await cartCollection.deleteOne(query);
      res.send(result);
    })

    // payment intent

    app.post('/create-payment-intent', async(req,res)=>{
      const {price}=req.body;
    if (!price || price < 0.5) {
      return res.status(400).send({ error: 'Price must be at least $0.50' });
    }
      const amount=parseInt(price * 100);
      console.log(amount);
      const paymentIntent=await stripe.paymentIntents.create({
        amount:amount,
        currency:'usd',
        payment_method_types:['card']
      })

      res.send({
        clientSecret:paymentIntent.client_secret
      })
    })


    app.get('/payments/:email',verifyToken, async(req,res)=>{
      const query={email:req.params.email}
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message: 'Forbidden Access!'})
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })


    app.post('/payments', async(req,res)=>{
      const payment=req.body;
      const paymentResult=await paymentCollection.insertOne(payment);


      // carefully delete each item from the cart
      console.log('payment info', payment);
      const query={_id:{
        $in:payment.cartIds.map(id=>new ObjectId(id))

      }}
      const deleteResult=await cartCollection.deleteMany(query);

      // // send user email about payment confirmaton
      // mg.message.create(process.env.MAIL_SENDING_DOMAIN,{
      //   from:"Mailgun Sandbox <postmaster@sandboxc77e88d8783b4af19a8fcffbf5df48dd.mailgun.org>",
      //   to:["forhaduddin195221@gmail.com"],
      //   subject:"Bistro Boss Order Confirmation",
      //   text:"Testing some mailgun",
      //   html:`<div>
      //     <h2>Thank you for your order</h2>
      //     <h4>Your Transaction ID: <strong>${payment.transactionId}</strong></h4>
      //   </div>`
      // })
      // .then(msg=>console.log(msg))
      // .catch(err=>console.log(err))
      res.send({paymentResult,deleteResult})
    })


  // messages api
   app.post("/messages", async (req, res) => {
    const meassage = req.body;

    const result = await messageCollection.insertOne(meassage);
    // Send back the inserted document info
    res.send(result);
  });

  app.get('/order-stats',verifyToken,verifyAdmin, async(req,res)=>{
    const result=await paymentCollection.aggregate([
       {
          $unwind:'$serviceItemIds'
        },
         // ✅ serviceItemIds কে ObjectId তে কনভার্ট করা হলো
    {
      $addFields: {
        serviceItemIds: { $toObjectId: "$serviceItemIds" }
      }
    },
        {
          $lookup:{
            from:'services',
            localField:'serviceItemIds',
            foreignField:'_id',
            as:'serviceItems'
          }
        },
        {
          $unwind:'$serviceItems'
        },
        // data pathanor jonno project korte hoi
        {
          $group:{
            _id:'$serviceItems.category',
            quantity:{
              $sum:1,
            },
            revenue:{$sum:'$serviceItems.price'}   

          }
        },
        {
          $project:{
            _id:0,
            category:'$_id',
            quantity:'$quantity',
            revenue:'$revenue'
          }
        }
    ]).toArray();
    res.send(result)
  })

  // stats or analytics
    app.get('/admin-stats',verifyToken,verifyAdmin, async(req,res)=>{
      const users=await userCollection.estimatedDocumentCount();
      const serviceItems=await serviceCollection.estimatedDocumentCount();
      const orders=await paymentCollection.estimatedDocumentCount();

      // // this is not the best way
      // const payments=await paymentCollection.find().toArray();
      // const revenue=payments.reduce((total,payment)=>total + payment.price,0);
      const result=await paymentCollection.aggregate([
        {
          $group:{
            _id:null,
            totalRevenue:{
              $sum:'$price'
            }
          }
        }
      ]).toArray();

      const revenue=result.length>0 ? result[0].totalRevenue:0;

      res.send({
        users,
        serviceItems,
        orders,
        revenue
      })
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Bistro is Sitting!")
})

app.listen(port, () => {
    console.log(`Bistro is Sitting at on port ${port}`);
})