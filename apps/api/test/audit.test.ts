import { describe, expect, it } from 'vitest';
import { scoreCandidate } from '../src/modules/audit/audit.service.js';

const baseRef = {
  realName: '张三',
  wechatNickname: 'zhangsan_wx',
  schoolId: 101n,
};

describe('认领候选匹配评分', () => {
  it('姓名+昵称+学校全命中得分最高', () => {
    const score = scoreCandidate(
      { realName: '张三', wechatNickname: 'zhangsan_wx', schoolId: 101n },
      baseRef,
    );
    expect(score).toBe(190);
  });

  it('仅学校一致时得分低', () => {
    const score = scoreCandidate(
      { realName: '李四', wechatNickname: 'lisi_wx', schoolId: 101n },
      baseRef,
    );
    expect(score).toBe(30);
  });

  it('姓名部分包含仍有得分', () => {
    const ref = { realName: '张三丰', wechatNickname: null, schoolId: null };
    const score = scoreCandidate({ realName: '张三', wechatNickname: null, schoolId: null }, ref);
    expect(score).toBe(40);
  });

  it('昵称相似（包含）有得分', () => {
    const ref = { realName: null, wechatNickname: 'zhangsan_wx_2024', schoolId: null };
    const score = scoreCandidate({ realName: '', wechatNickname: 'zhangsan_wx', schoolId: null }, ref);
    expect(score).toBe(25);
  });

  it('完全无关时为零分', () => {
    const ref = { realName: '王五', wechatNickname: 'wangwu_wx', schoolId: 134n };
    const score = scoreCandidate({ realName: '赵六', wechatNickname: 'zhaoliu', schoolId: 1n }, ref);
    expect(score).toBe(0);
  });
});
