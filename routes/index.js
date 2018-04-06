var express = require('express');
var fs=require("fs");
var multer = require('multer');//处理上传文件的模块
var router = express.Router();
var jpeg=require("jpeg-js");//编解码jpg图片的模块
var bmp=require("bmp-js");//编解码bmp图片的模块

var urlOriginalImage;//原始图片
var urlWatermarkImage;//水印图片
var urlWatermarkedImage;//加入水印后的图片
var ifDetection=0;//区分加入和提取水印两种操作

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../public/server/')
  },
  filename: function (req, file, cb) {
    var tempUrl = file.fieldname + '-' + Date.now();
    if (file.fieldname == "watermarked") {
      tempUrl=tempUrl + ".bmp";
      urlWatermarkedImage = tempUrl;
      ifDetection=0;//默认用户选择正确
    }
    if (file.fieldname == "image"){
      tempUrl=tempUrl + ".jpg";
      urlOriginalImage = tempUrl;
      ifDetection=ifDetection+1;
    }
    if (file.fieldname == "waterMark") {
      tempUrl=tempUrl + ".jpg";
      urlWatermarkImage = tempUrl;
      ifDetection=ifDetection+1;
    }
    cb(null, tempUrl);
  }
});//保存用户上传的图片至服务端

var upload = multer({ storage: storage });

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: '数字水印' ,url:"images/output.jpg"});
});

var cpUpload = upload.fields([ { name: 'waterMark', maxCount: 1 }, { name: 'image', maxCount: 1 },{ name: 'watermarked', maxCount: 1 } ]);

router.post('/',cpUpload,function(req,res,next){
  var output;
  if(ifDetection==2) {
    output = waterMarking(urlOriginalImage, urlWatermarkImage);
  }//加入水印
  else if(ifDetection==0) {
    output = detection(urlWatermarkedImage);
  }//检测水印
  else
    output="images/003.jpg";
  var tmpUrl="/server/"+output;
  ifDetection=0;
  res.render("index", {title:"数字水印",url:tmpUrl});
});

function waterMarking(path1,path2) {
  var image1=readImage("../public/server/"+path1);
  var image2=readImage("../public/server/"+path2);

  width1=image1.width;
  height1=image1.height;

  width2=image2.width;
  height2=image2.height;

  //水印太大
  if(height2*width2*3*8+24>height1*width1*3&&height2<=511&&width2<=511)
    return "images/001.jpg";
  else{
    var pixel1,pixel2;
    var length1,length2;//记录二进制长度
    //记录长宽信息
    width2String=width2.toString(2);//如1101011
    height2String=height2.toString(2);//二进制字符串

    length3=width2String.length;//如7
    length4=height2String.length;//如5

    var a;
    for(var i=0;i<9;i++) {
      a=parseInt(i/3)+i;
      if (i < 9 - length3)//0,1,2，补0
      {
        pixel1 = parseInt(image1.data[a].toString(2));//2进制字符串
        pixel1=pixel1.toString();
        length1 = pixel1.length;
        pixel1=pixel1.substring(0,length1-1)+0;
      }
      else {//3,4,5,6,8
        pixel1 = parseInt(image1.data[a].toString(2));
        pixel1=pixel1.toString();
        length1 = pixel1.length;
        pixel1=pixel1.substring(0,length1-1)+width2String[i+length3-9];
      }
      pixel1 = parseInt(pixel1, 2);
      image1.data[a] = pixel1;
    }//9个数据最后一位存储宽度值

	  for(i=0;i<9;i++) {
      a=parseInt(i/3)+i;
      if (i < 9 - length4)//0,1,2
      {
        pixel1 = parseInt(image1.data[a+12].toString(2));//2进制字符串
        pixel1=pixel1.toString();
        length1 = pixel1.length;
        pixel1=pixel1.substring(0,length1-1)+0;
      }
      else {//3,4,5,6,7
        pixel1 = parseInt(image1.data[a+12].toString(2));
        pixel1=pixel1.toString();
        length1 = pixel1.length;
        pixel1=pixel1.substring(0,length1-1)+width2String[i+length4-9];
      }
      pixel1 = parseInt(pixel1, 2);
      image1.data[a+12] = pixel1;
    }//前24个数据（中的18个）存储了宽高信息

    for(i=0;i<height2*width2*3;i++) {
      a=parseInt(i/3)+i;
      pixel2 = parseInt(image2.data[a]).toString(2);//水印二进制如110
      pixel2 = pixel2.toString();
      length2 = pixel2.length;//如3
      var b;

      for (j = 0; j < 8 - length2; j++)//0,1,2,3,4
      {
        //补齐8位，令原图中最后一位变为0
        b=24+parseInt((i*8+j)/3)+i*8+j;
        pixel1 = parseInt(image1.data[b]).toString(2);
        pixel1 = pixel1.toString();
        length1 = pixel1.length;//如5
        pixel1=pixel1.substring(0,length1-1)+0;
        pixel1 = parseInt(pixel1, 2);
        image1.data[b] = pixel1;//0,1,2
      }
      var k = 0;
      for (j = 8 - length2; j < 8; j++, k++)//j=5,6,7,k=0,1,2
      {
        b=24+parseInt((i*8+j)/3)+i*8+j;
        pixel1 = parseInt(image1.data[b]).toString(2);//
        pixel1 = pixel1.toString();
        length1 = pixel1.length;
        pixel1=pixel1.substring(0,length1-1)+pixel2[k];
        pixel1 = parseInt(pixel1, 2);
        image1.data[b] = pixel1;//0,1,2
      }
    }//存储图片信息

    //编码成bmp图像
    var rawImageData = {
      width: width1,
      height: height1,
      data: image1.data
    };

    var bmpImageData = bmp.encode(rawImageData);
    fs.writeFile("../public/server/"+urlOriginalImage+".bmp", bmpImageData.data, {flag: 'a'}, function (err) {
      if (err) {
        console.error(err);
      } else {
        console.log('写入成功');
      }
    });
    return urlOriginalImage+".bmp";//返回输出地址
  }//如果能够加入水印
}//水印制作：返回加入水印后的图像

function detection(path){
  var image=readBmpImage("../public/server/"+path);//添加水印后的图像信息
  var view=new Uint8Array(image.data);
  var width="";
  var height="";
  var pixel1;
  var pixel2;
  var length;
  var c,d;
  for(var i=0;i<9;i++) {
    c=parseInt(i/3)+i;
    pixel1 = parseInt(view[c].toString(2));//2进制字符串
    pixel1 = pixel1.toString();//如10111110
    length = pixel1.length;
    pixel1 = pixel1.substring(length - 1, length);
    width = width + pixel1;

    d=parseInt(i/3)+i+12;
    pixel2 = parseInt(view[d].toString(2));
    pixel2 = pixel2.toString();
    length = pixel2.length;
    pixel2 = pixel2.substring(length - 1, length);
    height = height + pixel2;//字符串
  }//得到水印图像的长宽信息
  width=parseInt(width,2);

  height=parseInt(height,2);
  var m=0;

  var frameData= new Array(height*width*4);
  for(i=0;i<height*width*3;i++){
    var k=i%3;
    var pixel="";
    var e;
    for(var j=0;j<8;j++){
      e=parseInt((i*8+j)/3)+(i*8+j)+24;
      pixel1=parseInt(view[e].toString(2));
      pixel1=pixel1.toString();//100001
      length=pixel1.length;
      var b=pixel1.substring(length-1,length);
      pixel=pixel+b;
    }
    pixel=parseInt(pixel,2);
    m=parseInt(i/3)*4+k;
    frameData[m]=pixel;
    if(k==2)
      frameData[m+1]=255;
  }

  var rawImageData = {
    data: frameData,
    width: width,
    height: height
  };//图像数据

  var jpegImageData = jpeg.encode(rawImageData, 100);
  fs.writeFile("../public/server/"+path+".jpg", jpegImageData.data, {flag: 'a'}, function (err) {
    if (err) {
      console.error(err);
    } else {
      console.log('写入成功');
    }
  });
  return path+".jpg";
}//水印检测:返回水印

function readImage(path){
  var jpegData=fs.readFileSync(path);
  return jpeg.decode(jpegData,true);
}//读取jpeg格式的图片

function readBmpImage(path){
  var bmpData=fs.readFileSync(path);
  return bmp.decode(bmpData);
}//读取bmp格式的图片

module.exports = router;


