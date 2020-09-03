#! node
let request = require("request");
let cheerio = require("cheerio");
let fs = require("fs");
let chalk = require("chalk");
let ics = require("ics");
let {newSemester,stuID} = require('./config.js');

// 学期开始时间
let semesterBegin = new Date(`${newSemester} 00:00:00`);
// 初始化第一周时间
let weekday = new Array(7).fill(semesterBegin.getTime()).map((el, index) => {
  return el + index * 86400000;
});
// 设置课程开始时间
let begin = [28800000, 36900000, 50400000, 58500000, 68400000, 74700000];
// 设置一周时长
let week = 86400000 * 7;
// 课程数组
let classTable = [];
// 生成课表函数
function generate(stuid) {
  request(`http://jwzx.cqupt.edu.cn/kebiao/kb_stu.php?xh=${stuid}`, function (
    err,
    response,
    body
  ) {
    if (err === null && response.statusCode === 200) {
      console.log(chalk.blue("[Message]") + " 连接成功");

      let $ = cheerio.load(body);
      let tb = $("#stuPanel tbody tr");
      // 按行处理课表
      for (let i = 0; i < tb.length; i++) {
        let duration = cheerio.load(tb[i])("td").first().text();
        let index = [
          "1、2节",
          "3、4节",
          "5、6节",
          "7、8节",
          "9、10节",
          "11、12节",
        ].indexOf(duration);
        if (["中午间歇", "下午间歇"].indexOf(duration) !== -1) {
          console.log(chalk.cyan("[Scan Rows]") + " 跳过 ->" + duration + "<-");
        } else {
          console.log(
            chalk.cyan("[Scan Rows]") + " 正在处理 ->" + duration + "<-"
          );
          addCourse(tb[i], index);
        }
      }
      // 处理成ics文件
      console.log(chalk.blue("[Message]") + " 正在处理为日历ics文件");
      const { error, value } = ics.createEvents(classTable);
      if (error) {
        console.log(chalk.red("[Error]" + error));
        return;
      }
      console.log(chalk.blue("[Message]") + " 成功转化为ics格式");
      console.log(chalk.blue("[Message]") + " 正在生成ics文件");
      fs.writeFileSync(`${__dirname}/${stuid}.ics`, value);
      console.log(chalk.greenBright("[Success]") + " 生成ics文件成功!");
      console.log(chalk.greenBright("[Message]"+" Created By IsLand 2020 Sept. 1st"))
    }
  });
}

function addCourse(tr, duration) {
  let row = cheerio.load(tr);
  let weekAndCourse = row("td:not(td[style])");
  // 处理每个单元格
  for (let i = 0; i < weekAndCourse.length; i++) {
    console.log(
      chalk.yellow("[Scan Weekday]") + " 正在处理周" + (i + 1) + "课程"
    );
    let courses = cheerio.load(weekAndCourse[i])("div");
    // 处理每个单元格的课程
    for (let j = 0; j < courses.length; j++) {
      const course = cheerio.load(courses[j]);
      let courseInfo = course.text();
      let zc = course("div").attr("zc");
      if (!courseInfo) {
        continue;
      } else {
        let reg = /(.+)-(.+)地点：(.+)\s+(.+周)(.+)\s+(.+学分)/;
        let array = reg.exec(courseInfo);
        let lasttime = { hours: 1, minutes: 40 };
        if (courseInfo.indexOf("3节连上") !== -1) {
          lasttime = { hours: 3 };
        } else if (courseInfo.indexOf("4节连上") !== -1) {
          lasttime = { hours: 3, minutes: 55 };
        }
        // 处理课程每周
        for (let k = 0; k < zc.length; k++) {
          if (zc.charAt(k) == 1) {
            classTable.push({
              title: array[2],
              location: array[3],
              description:
                array[4] + " " + array[5] + " " + array[6] + " " + array[1],
              start: formatDate(weekday[i] + week * k + begin[duration]),
              duration: lasttime,
              status: "TENTATIVE",
              categories: ["重邮课程", array[2]],
              alarms: [
                {
                  action: "display",
                  trigger: { hours: 0, minutes: 15, before: true },
                },
              ],
              busyStatus: "BUSY",
              calName: "重邮课表",
            });
          }
        }
        console.log(
          chalk.magenta("[Add Success]") + " 处理完成课程 -> " + array[2]
        );
      }
    }
  }
}

function formatDate(time) {
  let date = new Date(time);
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
}

generate(stuID);
