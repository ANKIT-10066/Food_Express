import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from "dotenv";
dotenv.config();
import Stripe from 'stripe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'
import path from "path";


const app=express();

app.use(cors());
app.use(express.json({limit:"10mb"}));

const PORT=process.env.PORT || 8080

//mongodb connection
mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("Connected to Database Successfully"))
  .catch((err) => {console.log(err) ; console.log("Failed to connect to DataBase")});

//userschema
const userSchema = mongoose.Schema({
  firstName: String,
  lastName: String,
  email: {
    type: String,
    unique: true,
  },
  password: String,
  confirmPassword: String,
  image: String,
});

const userModel = mongoose.model("user", userSchema);
//api/get
app.get("/",(req,res)=>{
    //console.log(req.body)
    res.send("server is running");
})
//api/signUp
app.post("/signUp",async(req,res)=>{
    const { email } = req.body;
   const result=await userModel.findOne({ email: email });
   if (result) {
    res.send({ message: "Email id is already registered", alert: false });
  } else {
    const data =await  userModel(req.body);
    const save =await data.save();
    res.send({ message: "Successfully Registered", alert: true });
  }
})
//api/login
app.post("/login",async(req,res)=>{
  const { email,password } = req.body;
   try{
     const result=await userModel.findOne({ email: email });
     if (!result) {
       return res.json({ message: "Email not found ! Please Sign Up ", alert: false });
     }else{
    const isMatch= await bcrypt.compare(password, result.password);
    if(isMatch){
        const userdetails = {
            _id: result._id,
            firstName: result.firstName,
            lastName: result.lastName,
            email: result.email,
            image: result.image,
          };
          // console.log(userdetails);
          const payload = {
            user: {
                id: result.id
            }
        };

        jwt.sign(payload,process.env.JWT_SECRET_KEY, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.json({token, message: "Login successful",
            alert: true,
            data: userdetails,});
              });
        }else{
          res.json({message:"Password Incorrect",alert:false})
        }
      }
    }catch(error){
     // console.log(error);
     res.status(500).json({ message: 'Internal Server Error' });
    }
})

//product section

const schemaProduct = mongoose.Schema({
  name: String,
  category:String,
  image:{
    type :String,
    unique:true,
  },
  price: String,
  description: String,
});
const productModel = mongoose.model("product",schemaProduct)

//save product data 

app.post("/uploadProduct",async(req,res)=>{
   // console.log(req.body)
    const data = await productModel(req.body)
    const datasave = await data.save()
    //console.log(datasave)
    res.send({message : "Upload successful"})
})

app.get("/product",async(req,res)=>{
   const data=await productModel.find({});
   res.send(JSON.stringify(data));
})
app.delete('/deleteProduct/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const deletedProduct = await productModel.findByIdAndDelete(productId);
    if (!deletedProduct) {
      // If the product with the given ID is not found, return 404
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    return res.status(500).json({message: 'Internal server error' });
  }
})

/*Payment GateWay */

//console.log(process.env.STRIPE_SECRET_KEY)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post("/create-checkout-session", async (req, res) => {
  const { items } = req.body;
  const token = req.headers.authorization;

  if (!token) {
      return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
      // Verify the token
      const decoded = jwt.verify(token.split(' ')[1],process.env.JWT_SECRET_KEY);
      const lineItems = items.map(item => {
          return {
              price_data: {
                  currency: "inr",
                  product_data: {
                      name: item.name,
                      // images: [item.image] // You can include images if needed
                  },
                  unit_amount: item.price * 100,
              },
              adjustable_quantity: {
                  enabled: true,
                  minimum: 1,
              },
              quantity: item.qty,
          };
      });
      const params = {
          submit_type: 'pay',
          mode: "payment",
          payment_method_types: ['card'],
          line_items: lineItems,
          billing_address_collection: 'required',
          shipping_options: [{ shipping_rate: "shr_1PJ94iSHaDkDMVyDzNnTK2Lx" }],
          success_url: `${process.env.FRONTEND_URL}/success`,
          cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      };

      const session = await stripe.checkout.sessions.create(params);
      res.status(200).json(session);
  } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message });
  }
});

  /* Deployment */
if(process.env.NODE_ENV==="production"){
  const __dirname=path.resolve();
  app.use(express.static(path.join(__dirname,"/frontend/build")));
  app.get("*",(req,res)=>{
    res.sendFile(path.resolve(__dirname,"frontend","build","index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
