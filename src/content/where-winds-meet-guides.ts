export type Guide = {
  slug: string;
  category: string;
  title: string;
  detail: string;
  body: string[];
  status: "starter" | "reviewed";
};

export const whereWindsMeetGuides: Record<"th" | "en", Guide[]> = {
  th: [
    { slug: "tune-gvg", category: "Tune", title: "พื้นฐานการจัด Tune สำหรับ GVG", detail: "เริ่มจากบทบาทและหน้าที่ของทีม แล้วค่อยเลือก Tune ที่เหมาะกับแผน", body: ["การ Tune สำหรับ GvG ใช้ Tune Arena Attune โดยใช้ดอกไม้สีชมพู", "Tune ส่วนหมวก: Priority คือกรอบสีเขียว ให้จูนจนกว่าจะได้ผลเพิ่มระยะเวลา Tenacity หลังใช้ Serene Breeze", "กรอบเหลืองช่วยลดคูลดาวน์ Serene Breeze ได้ 4 วินาที ส่วนกรอบแดงไม่ใช้"], status: "starter" },
    { slug: "mystic-skill", category: "Mystic Skill", title: "Mystic Skill ที่ควรรู้ก่อนลงสนาม", detail: "สรุป Skill AOE สำคัญและจังหวะที่ควรสื่อสารกับทีม", body: ["สกิล AOE ทุกคนควรมีเพื่อช่วยทำดาเมจ: Flaming Meteor (สำคัญอันดับ 1), Lion's Roar (อันดับ 2), Bursting Nine และ Flute of the Tides", "แนะนำให้อัป Flaming Meteor ถึงขั้น 6 แบบอัปเกรดเพื่อเพิ่มรัศมีวงสกิล และใช้ในจังหวะเพื่อนดูดหรือตะลุมบอล", "Lion's Roar ช่วยลด Endurance และหากใช้หลัง Leaping Toad จะแพร่พิษไปยังศัตรูอื่นได้"], status: "starter" },
    { slug: "ex-skill", category: "EX Skill", title: "แนวทาง EX Skill แยกตามบทบาท", detail: "รายการตั้งต้นสำหรับ DPS, Tank และ Support เพื่อใช้คุยในกิลด์", body: ["เลือก EX Skill ให้สอดคล้องกับหน้าที่ในแผน ไม่จำเป็นต้องใช้ชุดเดียวกันทุกคน", "Tank ควรเตรียม Skill ที่ช่วยดึงหรือควบคุมพื้นที่ ส่วน DPS ให้เน้นจังหวะ burst และการตาม call ของทีม", "ชุดนี้เป็นแนวทางเริ่มต้น ควรตรวจสอบกับ patch และแผนล่าสุดก่อนประกาศใช้"], status: "starter" },
    { slug: "command-skill", category: "Command Skill", title: "Command Skill และการประสานงาน", detail: "แนวคิดการจับคู่ Skill กับช่วงเวลาของแผนการรบ", body: ["Frontline Zeal เพิ่มดาเมจในการตีป้อมและห่าน เหมาะกับการอัปต่อเนื่องเมื่อมีทรัพยากร", "Sprint ใช้เร่งการแบกต้นไม้ และ Relentless Advance ใช้ช่วยคนแบกเมื่อถูก CC หนัก", "ควรประกาศผู้กดและจังหวะใช้ใน Discord เพื่อลดการกดซ้ำและประหยัด Command Point"], status: "starter" }
  ],
  en: [
    { slug: "tune-gvg", category: "Tune", title: "GVG tune fundamentals", detail: "Start with the team role, then choose a tune that fits the plan.", body: ["GVG tune uses Arena Attune with pink flowers.", "For the helmet, prioritize the green frame to extend Tenacity after Serene Breeze.", "The yellow frame can reduce Serene Breeze cooldown by 4 seconds; skip the red frame."], status: "starter" },
    { slug: "mystic-skill", category: "Mystic Skill", title: "Mystic skills to know before battle", detail: "A starter note on important AOE skills and team callouts.", body: ["Everyone should carry an AOE skill: Flaming Meteor (priority 1), Lion's Roar (priority 2), Bursting Nine, and Flute of the Tides.", "Upgrade Flaming Meteor to tier 6 enhanced for a larger radius and use it during group pulls.", "Lion's Roar reduces Endurance and can spread poison after Leaping Toad."], status: "starter" },
    { slug: "ex-skill", category: "EX Skill", title: "EX skills by role", detail: "A starting list for DPS, Tank, and Support discussions.", body: ["Choose an EX Skill that matches the job in the plan; not everyone needs the same setup.", "Tanks should prepare control and area tools, while DPS should focus on burst timing and team calls.", "Review this starter note against the current patch before publishing it as final guidance."], status: "starter" },
    { slug: "command-skill", category: "Command Skill", title: "Command skills and coordination", detail: "Ideas for pairing skills with key moments in the battle plan.", body: ["Frontline Zeal boosts damage against towers and the goose; upgrade it steadily when resources allow.", "Use Sprint to speed tree carrying and Relentless Advance when the carrier is under heavy CC.", "Call out the user and timing in Discord to avoid duplicate casts and wasted Command Points."], status: "starter" }
  ]
};
