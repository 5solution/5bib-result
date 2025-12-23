## Task: Result Race API + Cron Job

Build the following features:

- config elastic search in src/config/index.ts
- data get from

100km:https://api.raceresult.com/373872/DRUJ4JZIAZVR9HL3Z95VMT3N1EOUYRX6
70km: https://api.raceresult.com/373872/L4OGZSDRG90JJB34CWIAM6I5BBQS744E
42km: https://api.raceresult.com/373872/XNMXT8815X4PMOH8PIQJU9BMOILKSR7Q
25km: https://api.raceresult.com/373872/OBZ7O5A02PGVHAOTJ2F7Y9QGE6VXDIZK
10km: https://api.raceresult.com/373872/WKI4EML9T6R7Z582HRKDXOF2188697KX

example response
```
[
  {
    "Bib": 8065,
    "Name": "DƯƠNG THỊ  HOA ",
    "OverallRank": 6,
    "GenderRank": 1,
    "CatRank": 1,
    "Gender": "Female",
    "Category": "Female 30-39",
    "ChipTime": "18:41:32",
    "GunTime": "18:41:36",
    "TimingPoint": "Finish",
    "Pace": "11:12",
    "Certi": "https://my4.raceresult.com/373872/certificates/8065/100KM",
    "Certificate": "https://my4.raceresult.com/373872/certificates/8065/100KM",
    "OverallRanks": "{\"Start\":\"6\",\"TM1\":\"13\",\"TM2\":\"8\",\"TM3\":\"6\",\"TM4\":\"5\",\"Finish\":\"6\"}",
    "GenderRanks": "{\"Start\":\"4\",\"TM1\":\"3\",\"TM2\":\"1\",\"TM3\":\"1\",\"TM4\":\"1\",\"Finish\":\"1\"}",
    "Chiptimes": "{\"Start\":\"00:00\",\"TM1\":\"4:35:07\",\"TM2\":\"11:26:09\",\"TM3\":\"15:30:36\",\"TM4\":\"18:30:53\",\"Finish\":\"18:41:32\"}",
    "Guntimes": "{\"Start\":\"00:05\",\"TM1\":\"4:35:11\",\"TM2\":\"11:26:14\",\"TM3\":\"15:30:41\",\"TM4\":\"18:30:57\",\"Finish\":\"18:41:36\"}",
    "Paces": "{\"Start\":\"\",\"TM1\":\"10:44\",\"TM2\":\"11:19\",\"TM3\":\"11:00\",\"TM4\":\"11:05\",\"Finish\":\"11:10\"}",
    "TODs": "{\"Start\":\"1:16:00:05\",\"TM1\":\"1:20:35:11\",\"TM2\":\"2:03:26:14\",\"TM3\":\"2:07:30:41\",\"TM4\":\"2:10:30:57\",\"Finish\":\"2:10:41:36\"}",
    "Sectors": "{\"Start\":\"00:00\",\"TM1\":\"4:35:07\",\"TM2\":\"6:51:02\",\"TM3\":\"4:04:27\",\"TM4\":\"3:00:17\",\"Finish\":\"10:39\"}",
    "OverrankLive": 0,
    "Gap": "+3:37:51",
    "Nationality": "",
    "Nation": ""
  },
]
```

### 1. API: Get Result Race

- Create **GET API** to return race results from stored data.
- Support:
  - Search by **race_id** (example 373872) and **distance** (example 100km, it's course_id)
  - Search by **name**
  - Filter by **gender**
  - Filter by **category**
- Data source: **Elasticsearch**

example params: course_id=708&pageSize=10&pageNo=1&sortField=OverallRank&sortDirection=ASC&gender=Female&category=Female+35+to+Under+45

### 2. Cron Job: Sync Result Data

- Create a **cron job** that runs **every 1 minute**.
- Call an **external GET API** provide above
- Fetch new race results.
- Normalize and **save/update data into Elasticsearch**. (with no downtime if your search)

### 3. Data Storage

- Use **Elasticsearch** as the main database for race results.
- Ensure data can be queried efficiently for search and filters.

### Notes

- Avoid duplicate records when syncing.
- API response should support pagination if needed.
- Keep logic simple and clean.
