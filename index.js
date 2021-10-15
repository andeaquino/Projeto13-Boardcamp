import express from 'express';
import pg from 'pg';
import Joi from 'joi';

const { Pool } = pg;

const connection = new Pool({
  user: 'bootcamp_role',
  host: 'localhost',
  port: 5432,
  database: 'boardcamp',
  password: 'senha_super_hiper_ultra_secreta_do_role_do_bootcamp'
});

const categorySchema = Joi.object({name: Joi.string().required()})

const app = express();
app.use(express.json());

app.get('/categories', async (req, res) => {
  try {
    const categories = await connection.query('SELECT * FROM categories');
    res.send(categories.rows).status(200);
  } catch {
    res.sendStatus(500);
  }
});

app.post('/categories', async (req, res) => {
  const { name } = req.body;

  try {
    const categoryCheck = await connection.query('SELECT * FROM categories WHERE name = $1', [name]);

    if (categoryCheck.rows.length !== 0) {
      return res.sendStatus(409);
    }
  
    if (categorySchema.validate({name}).error) {
      return res.sendStatus(400);
    }

    await connection.query('INSERT INTO categories (name) VALUES ($1)', [name]);
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.listen(4000);