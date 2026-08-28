/* Copy that appears on more than one page. Shared through a plain script tag,
   so the bios exist once rather than three times over. No bundler. */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.METRIS_CONTENT = factory();
})(typeof self !== "undefined" ? self : this, function () {

  var speakerNote = "My colleague Karlos and I lead this session together. He brings twenty-five years of experience inside large organizations, seeing where strategy succeeds, or breaks down, in operations. I build the measurement that shows whether it’s working. Together, we cover both sides of the question: what should you do, and how do you know it worked?";

  /* Two bios each. shortBio is the two sentences the panel shows; bio is the
     full version, opened from Read more. Everything anyone might want is in the
     full one, which matters for people who are new to this material. */
  var speakers = [
    {
      name: "Suneeta Modekurty",
      role: "Founder and CEO",
      org: "METRIS",
      photo: "suneeta-modekurty.jpg",
      linkedin: "https://www.linkedin.com/in/smodekurty/",
      shortBio: "Suneeta builds the measurement systems behind METRIS, after ten years as a data scientist and bioinformatician inside healthcare, insurance and life sciences companies. She teaches this material as an O\u2019Reilly live trainer.",
      bio: [
        "Suneeta builds the measurement systems behind METRIS, after ten years as a data scientist and bioinformatician inside healthcare, insurance, title and life sciences companies, where the hard part was rarely the model and almost always whether anyone could tell if it was working.",
        "She teaches this material as an O\u2019Reilly live trainer, wrote The AI-Human Synergy in 2024, and holds ISO/IEC 27701 and ISO/IEC 42001 Lead Auditor certification.",
        "She holds an MS in Bioinformatics from Indiana University, first-authored research presented at ASCO 2024, and reviews manuscripts for PLOS ONE and Frontiers.",
        "Before any of it she taught for seventeen years in India."
      ]
    },
    {
      name: "Karlos Bledsoe Sr.",
      role: "Certified Business and Executive Coach",
      org: "FocalPoint Coaching",
      photo: "karlos-bledsoe.jpg",
      linkedin: "https://www.linkedin.com/in/karlos-bledsoe/",
      shortBio: "Karlos is the pioneer of Gateway to Innovation, the St. Louis IT conference he founded. He spent more than 25 years at Anheuser-Busch, Edward Jones and BJC, finishing as Director of Strategy and Operations, and now coaches executives on strategy execution and operational performance.",
      bio: [
        "Karlos Bledsoe Sr. is a Focal Point business and executive coach. He uses his 25+ years with large companies; Anheuser-Busch, Edward Jones, and BJC, where he wrapped up his time as Director of Strategy and Operations\u2014to help companies overcome challenges, grow, and succeed.",
        "With strong and successful experience leading strategic planning, strategy execution, data warehousing, data analytics, project management, and lean-six sigma, he has led in IT, manufacturing, internal consulting/coaching, and sales training.",
        "Karlos is a husband and the father of four sons, where he enjoyed the crazy fun of sports, band instruments, academics, and navigating this hurried world. He\u2019s learned to balance professional and personal time, which is also part of his coaching.",
        "Karlos is a founding member of the St. Louis chapter of the Society for Information Management (SIM), the founder of the St. Louis Gateway to Innovation IT conference, served on the boards of City Academy School, and Great Circle \u2013 an organization dedicated to the treatment and care of emotionally disturbed children. Karlos is also an ordained minister at the First Baptist Church of Chesterfield."
      ]
    }
  ];

  var footer = {
    org: "METRIS by SANJEEVANI AI LLC \u00b7 St. Louis, Missouri",
    privacyUrl: "https://www.sanjeevaniai.com/privacy",
    termsUrl: "https://www.sanjeevaniai.com/terms",
    linkedin: "https://www.linkedin.com/company/sanjeevaniai/",
    replyTo: "hello@sanjeevaniai.com"
  };

  return { speakerNote: speakerNote, speakers: speakers, footer: footer };
});
