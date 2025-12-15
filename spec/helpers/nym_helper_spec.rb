# frozen_string_literal: true

require 'rails_helper'

RSpec.describe NymHelper, type: :helper do
  let(:instance) { FactoryGirl.create(:instance) }
  let(:user) { FactoryGirl.create(:user) }
  let(:other_user) { FactoryGirl.create(:user, username: 'other', email: 'other@example.com') }

  describe '#nym_tag' do
    it 'is deterministic for the same user and instance' do
      first = helper.nym_tag(user, instance: instance)
      second = helper.nym_tag(user, instance: instance)

      expect(first).to eq(second)
    end

    it 'differs between users' do
      first = helper.nym_tag(user, instance: instance)
      second = helper.nym_tag(other_user, instance: instance)

      expect(first).not_to eq(second)
    end
  end

  describe '#nym_glyph_svg' do
    it 'renders stable glyph markup for the same inputs' do
      svg_one = helper.nym_glyph_svg(user, instance: instance)
      svg_two = helper.nym_glyph_svg(user, instance: instance)

      expect(svg_one).to eq(svg_two)
      expect(svg_one).to include('<svg')
      expect(svg_one).to include('</svg>')
    end
  end
end
