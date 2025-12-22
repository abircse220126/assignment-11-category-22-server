const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECURE);

app.use(cors());
app.use(express.json());

// assignment-11
// LCA3HYa3XTVpGXvT
const uri = `mongodb+srv://assignment-11:LCA3HYa3XTVpGXvT@cluster0.owrghg5.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const Db = client.db("Assignment-11");
    const userCollection = Db.collection("userCollection");
    const loanCollection = Db.collection("loanCollection");
    const applicationCollection = Db.collection("applicationCollection");

    //  payment Related ApIs

    app.post("/create-checkout-session", async (req, res) => {
      try {
        const paymentinfo = req.body;

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: 1500,
                product_data: {
                  name: paymentinfo.name || "Loan EMI Payment",
                },
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          customer_email: paymentinfo.email,

          payment_intent_data: {
            metadata: {
              loanId: paymentinfo.loanId,
            },
          },
          
          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
        });

        res.send({ url: session.url });
      } catch (error) {
        console.error("Stripe error:", error.message);
        res.status(400).send({ error: error.message });
      }
    });

    // app.patch("/payment-success/:session_id",async(req, res)=>{

    //   const sessionId=req.params.session_id
    //    const session = await stripe.checkout.sessions.retrieve(sessionId)
    //   console.log(session)
    //   if(session. payment_status){

    //   }
    //   res.send({success: true})
    // })

    // Authentic user APIs is here

    app.patch("/payment-success", async (req, res) => {
      try {
        const sessionId = req.query.session_id;

        console.log(req.query);

        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["payment_intent"],
        });

        if (session.payment_status === "paid") {
          const loanId = session.payment_intent.metadata.loanId;

          const query = { _id: new ObjectId(loanId) };
          const update = {
            $set: {
              status: "paid",
            },
          };
          const options = {};
          const result = await applicationCollection.updateOne(
            query,
            update,
            options
          );
          res.send(result);
        }

        res.send({ success: true });
      } catch (err) {
        console.error(err.message);
        res.status(500).send({ error: err.message });
      }
    });

    app.post("/users", async (req, res) => {
      // console.log("post api is hitting");
      const user = req.body;
      user.create = new Date();

      const email = req.body.email;
      const query = { email: email };

      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", inserted: false });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // post loan by Manager
    app.post("/loans", async (req, res) => {
      const loan = req.body;
      const result = await loanCollection.insertOne(loan);
      res.send(result);
    });

    //  get user Role using email
    app.get("/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send({ role: result.role });
    });

    //  get user Informaion
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    // get user by id
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Loan Application form APIs
    app.post("/applicationform", async (req, res) => {
      const loanApplication = req.body;
      const result = await applicationCollection.insertOne(loanApplication);
      res.send(result);
    });

    // Cancle Application
    app.delete("/application/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await applicationCollection.deleteOne(query);
      res.send(result);
    });

    // get all application user
    app.get("/applicationform", async (req, res) => {
      const cursor = applicationCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // find all the user
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // find application by email
    app.get("/application/:email", async (req, res) => {
      const email = req.params.email;
      const result = await applicationCollection.find({ email }).toArray();
      res.send(result);
    });

    // find all the loan card
    app.get("/loans", async (req, res) => {
      const cursor = loanCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // find only 6 loan cards
    app.get("/loanscardhome", async (req, res) => {
      const query = { showHome: true };
      const cursor = loanCollection.find(query).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // find a particular Item
    app.get("/loan/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await loanCollection.findOne(query);
      res.send(result);
    });

    // update loan by Admin
    app.patch("/updates/:id", async (req, res) => {
      const id = req.params.id;
      const updateLoan = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          loanImage: updateLoan.loanImage,
          loanTitle: updateLoan.title,
          loanDescription: updateLoan.description,
          loanCategory: updateLoan.category,
          interest: updateLoan.interest,
          maxLoanLimit: updateLoan.loanlimit,
          emiPlans: updateLoan.emi,
        },
      };
      const options = {};
      const result = await loanCollection.updateOne(query, update, options);
      res.send(result);
    });

    // update show home
    app.patch("/loans/show-no-home/:id", async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          showHome: updateInfo.showHome,
        },
      };
      const options = {};
      const result = await loanCollection.updateOne(query, update, options);
      res.send(result);
    });

    // update user status
    app.patch("/user/update/:id", async (req, res) => {
      const id = req.params.id;
      const updateUser = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          status: updateUser.status,
        },
      };
      const options = {};
      const result = await userCollection.updateOne(query, update, options);
      res.send(result);
    });

    // update application status
    app.patch("/application/status/:id", async (req, res) => {
      const id = req.params.id;
      const application = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          status: application.status,
        },
      };
      const options = {};
      const result = await applicationCollection.updateOne(
        query,
        update,
        options
      );
      res.send(result);
    });

    // Delete Loan
    app.delete("/loan/delete/:id", async (req, res) => {
      const id = req.params.id;
      const cursor = { _id: new ObjectId(id) };
      const result = await loanCollection.deleteOne(cursor);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("the server is connected");
});
app.listen(port, () => {
  console.log(`example app listing on port ${port}`);
});
