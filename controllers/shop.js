const Product = require("../models/product");
const Cart = require("../models/cart");
const redis = require("../util/redis");
const axios = require('axios');

const ERROR_PREFIX = "In shop controller, ";
const PRODUCT_LIST_CACHE_KEY = "product_list";
const LAMBDA = "https://q3jc35g140.execute-api.us-east-1.amazonaws.com/default/create-order";

exports.getProducts = async (req, res, next) => {
  try {
    // Check Redis cache for product list
    const cachedProducts = await redis.get(PRODUCT_LIST_CACHE_KEY);
    console.log(cachedProducts)
    if (cachedProducts) {
      console.log("Cache hit for product list");
      const products = JSON.parse(cachedProducts);
      console.log(products)
      return res.render("shop/product-list", {
        prods: products,
        pageTitle: "Products List",
        path: "/shop/product-list",
        hasProducts: products.length > 0,
      });
    }
    console.log("Cache miss for product list");

    const products = await Product.findAll();
    await redis.set(PRODUCT_LIST_CACHE_KEY, JSON.stringify(products), "EX", 3600);

    res.render("shop/product-list", {
      prods: products,
      pageTitle: "Products List",
      path: "/shop/product-list",
      hasProducts: products.length > 0,
    });
  }
  catch (error) {
    console.log("In shop controller, fetchAll: {}", error);
  }
};

exports.getProduct = (req, res, next) => {
  const productId = req.params.productId;
  Product.findByPk(productId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((error) => console.log("{} getProduct, {}", ERROR_PREFIX, error));
};

exports.getIndex = async (req, res, next) => {
  const response = await axios.get('https://d3gkg3w2sb3uli.cloudfront.net/navigation.ejs');
  const navigation = response.data;
  Product.findAll()
    .then((products) => {
      res.render("shop/index", {
        navigation,
        prods: products,
        pageTitle: "Shop",
        path: "/",
        hasProducts: products.length > 0,
      });
    })
    .catch((error) => {
      console.log("In shop controller, fetchAll: {}", error);
    });
};

exports.getCart = (req, res, next) => {
  req.user.getCart()
    .then(cart => {
      return cart.getProducts()
        .then(products => {
          res.render("shop/cart", {
            pageTitle: "Cart",
            path: "/shop/cart",
            products: products,
          });
        })
    })
    .catch(error => { console.log('Error in shop controller, getCart {}', error) });
};

exports.postCart = (req, res, next) => {
  const productId = req.body.productId;
  let fetchedCart;
  let newQuantity = 1;

  req.user.getCart()
    .then(cart => {
      fetchedCart = cart;
      return cart.getProducts({ where: { id: productId } })
    })
    .then(products => {
      let product;
      if (products.length > 0) {
        product = products[0];
      }
      if (product) {
        newQuantity = product.cartItem.quantity + 1;
        return product;
      }
      return Product.findByPk(productId);
    })
    .then(product => {
      return fetchedCart.addProduct(product, {
        through: { quantity: newQuantity }
      })
    })
    .then(() => {
      res.redirect("/cart");
    })
    .catch(error => console.log(error));

};

exports.postCartDeleteProduct = (req, res, next) => {
  const productId = req.body.productId;
  req.user.getCart()
    .then(cart => {
      return cart.getProducts({ where: { id: productId } })
    })
    .then(products => {
      const product = products[0];
      return product.cartItem.destroy();
    })
    .then(result => {
      res.redirect("/cart");
    })
    .catch(error => console.log(error));
};

exports.getOrders = (req, res, next) => {
  req.user
    .getOrders({ include: ['products'] })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => console.log(err));
};

exports.postOrder = (req, res, next) => {
  let fetchedCart;
  req.user
    .getCart()
    .then(cart => {
      fetchedCart = cart;
      return cart.getProducts();
    })
    .then(products => {
      return req.user
        .createOrder()
        .then(order => {
          return order.addProducts(
            products.map(product => {
              product.orderItem = { quantity: product.cartItem.quantity };
              const emailPayload = {
                data: {
                  p_name: product.dataValues.title,
                  p_price: product.dataValues.price,
                  p_quantity: product.cartItem.quantity,
                }
              };
              console.log(emailPayload);
              try {
                axios.post(LAMBDA, emailPayload);
                console.log('Order email notification sent');
              } catch (err) {
                console.error('Failed to send email notification:', err);
              }
              return product;
            })
          );
        })
        .catch(err => console.log(err));
    })
    .then(result => {
      return fetchedCart.setProducts(null);
    })
    .then(async (result) => {
      res.redirect('/orders');
    })
    .catch(err => console.log(err));
};



